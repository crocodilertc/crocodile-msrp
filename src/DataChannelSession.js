/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var states;

	// Private stuff
	states = {
		INIT: 'INIT',
		AWAIT_SDP: 'AWAIT_SDP',
		AWAIT_OPEN: 'AWAIT_OPEN',
		AWAIT_MSG: 'AWAIT_MSG',
		ESTABLISHED: 'ESTABLISHED',
		CLOSED: 'CLOSED'
	};
	
	/**
	 * Creates a new DataChannelSession object.
	 * 
	 * @class Represents an MSRP session over a WebRTC data channel.
	 */
	function DataChannelSession(con, dataChannel) {
		this.con = con;
		this.dataChannel = new CrocMSRP.DCWrapper(this, dataChannel);
		// Local reference to the config object
		this.config = con.config;
		// The session ID (as used in the local URI)
		this.sessionId = CrocMSRP.util.newSID();
		// The data channel label
		this.label = dataChannel.label;
		// The local endpoint URI for this session
		var localUri = new CrocMSRP.Uri();
		localUri.secure = true;
		localUri.authority = this.config.authority;
		localUri.port = 2855;
		localUri.sessionId = this.sessionId;
		localUri.transport = 'dc';
		this.localUri = localUri.toString();
		// The To-Path header for outgoing requests (set later)
		this.toPath = [];
		// The data channel stream identifier for this session
		this.streamId = dataChannel.id;
		// Flag indicating whether this is the active endpoint
		this.active = false;
		
		// The following are negotiated in the SDP offer/answer
		/**
		 * The primary payload types accepted/understood by the far end.
		 * See RFC 4975 section 8.6.
		 * @type String[]
		 */
		this.acceptTypes = [];
		/**
		 * The payload types accepted/understood by the far end when used within
		 * an allowed container type.
		 * See RFC 4975 section 8.6.
		 * @type String[]
		 */
		this.acceptWrappedTypes = [];
		
		// A map of in-progress incoming chunked messages (indexed on message ID)
		this.chunkReceivers = {};
		this.receiverCheckInterval = null;
		// A map of in-progress outgoing messages (indexed on message ID)
		this.chunkSenders = {};
		// An array of unfinished senders
		this.activeSenders = [];
		this.outstandingSends = 0;

		// Initialise the session state - after this, everything should use
		// the changeState() function instead.
		this.state = states.INIT;
		/**
		 * The FileParams object describing the file being transferred in this
		 * session. For outgoing file transfers, this can be provided as a
		 * parameter when creating the session. For incoming transfers, this
		 * is populated when the incoming SDP offer is parsed.
		 * @type CrocMSRP.FileParams
		 * @see CrocMSRP.Connection#createFileTransferSession
		 * @see CrocMSRP.DataChannelSession#getSdpAnswer
		 */
		this.fileParams = null;
	}

	// Public functions
	/**
	 * Sends a message (or file) over this session.
	 * 
	 * @param {String|ArrayBuffer|ArrayBufferView|Blob|File} body
	 * The message body to send (may be binary data/file).
	 * @param {String} [contentType]
	 * The MIME type of the provided body.
	 * @returns {String} The Message-ID of the sent message. This can be used
	 * to correlate notifications with the appropriate message.
	 */
	DataChannelSession.prototype.send = function(body, contentType) {
		var type = null;
		var self = this;

		if (body) {
			// Determine content type & size
			if (body instanceof String || typeof body === 'string') {
				type = contentType || 'text/plain';
			} else if (body instanceof Blob) {
				type = contentType || body.type || 'application/octet-stream';
			} else { // ArrayBuffer or view
				type = contentType || 'application/octet-stream';
			}
		}
		
		var sender = new CrocMSRP.ChunkSender(this, body, type);
		sender.onReportTimeout = function() {
			self.handleSenderTimeout(sender.messageId);
		};
		this.chunkSenders[sender.messageId] = sender;
		this.activeSenders.push(sender);

		this.processSendQueue();

		return sender.messageId;
	};
	
	/**
	 * Sends a file over this session.
	 * <p>
	 * Note that this is intended for use on a newly created session, before
	 * the SDP exchange.  This way the file details can be included in the SDP,
	 * allowing the receiver to make an informed decision on whether to accept
	 * or reject the transfer.
	 * 
	 * @param {String|ArrayBuffer|ArrayBufferView|Blob|File} file The message
	 * body to send (may be binary data/file).
	 * @param {CrocMSRP.FileParams} [params] Optional file parameters that may
	 * influence the construction of the SDP offer.
	 * @returns {String} The Message-ID of the sent message. This can be used
	 * to correlate notifications with the appropriate message.
	 */
	DataChannelSession.prototype.sendFile = function(file, params) {
		params.selector = params.selector || {};

		var selector = params.selector;
		// One of the following MUST be present for the file-selector
		selector.name = selector.name || file.name;
		selector.size = selector.size || file.size;
		selector.type = selector.type || file.type;
		selector.hash = selector.hash || {};
		
		params.id = params.id || CrocMSRP.util.newFileTransferId();
		params.disposition = params.disposition || 'render';
		
		this.fileParams = params;
		return this.send(file, params.selector.type);
	};
	
	/**
	 * Aborts an ongoing message receive.
	 * @param {String} [id] The ID of the message to abort.  If this is
	 * not specified then all incoming messages will be aborted.
	 */
	DataChannelSession.prototype.abortReceive = function(id) {
		if (id) {
			var receiver = this.chunkReceivers[id];
			if (!receiver) {
				throw new RangeError('Invalid message id');
			}
			
			receiver.abort();
		} else {
			for (id in this.chunkReceivers) {
				this.chunkReceivers[id].abort();
			}
		}
		// Cleanup will happen when the next chunk is received
	};

	/**
	 * Aborts an ongoing message send.
	 * @param {String} [id] The ID of the message to abort.  If this is
	 * not specified then all outgoing sends will be aborted.
	 */
	DataChannelSession.prototype.abortSend = function(id) {
		if (id) {
			var sender = this.chunkSenders[id];
			if (!sender) {
				throw new RangeError('Invalid message id');
			}
			
			sender.abort();
		} else {
			for (id in this.chunkSenders) {
				this.chunkSenders[id].abort();
			}
		}
		// Cleanup will happen when the next chunk is sent/report is received
	};

	/**
	 * Closes the session. Further messages received for this session will be
	 * rejected.
	 */
	DataChannelSession.prototype.close = function() {
		this.abortReceive();
		this.abortSend();
		changeState(this, states.CLOSED);
	};

	// Private methods/events
	DataChannelSession.prototype.addSdpAttributes = function(media, dcPort, type) {
		// Add an attribute describing the data channel
		// (see draft-ejzak-dispatch-webrtc-data-channel-sdpneg-00)
		var dcParams = 'stream='.concat(this.streamId,
				';label="', this.label, '"',
				';subprotocol="MSRP"');
		media.addAttribute('webrtc-DataChannel', [dcPort, dcParams].join(' '));

		// Add the subprotocol specific attributes
		// (see draft-ejzak-dispatch-msrp-data-channel-00)
		var attPrefix = dcPort.concat(':', this.streamId, ' ');
		media.addAttribute('wdcsa', attPrefix.concat(
				'accept-types:', this.config.acceptTypes.join(' ')));
		if (this.config.acceptWrappedTypes && this.config.acceptWrappedTypes.length > 0) {
			media.addAttribute('wdcsa', attPrefix.concat(
					'accept-wrapped-types:', this.config.acceptWrappedTypes.join(' ')));
		}
		media.addAttribute('wdcsa', attPrefix.concat(
				'path:', this.localUri));

		// Check whether this is a file transfer session
		var params = this.fileParams;
		if (params) {
			// This is an outgoing file transfer session; add extra SDP
			// attributes as per RFC 5547.
			var selector = '';
			
			if (params.description) {
				media.title = params.description;
			}
			if (params.selector.name) {
				selector = selector.concat('name:"',
					CrocMSRP.util.encodeSdpFileName(params.selector.name), '"');
			}
			if (params.selector.size) {
				if (selector) {
					selector += ' ';
				}
				selector = selector.concat('size:', params.selector.size);
			}
			if (params.selector.type) {
				var contentType;
				if (selector) {
					selector += ' ';
				}
				if (params.selector.type instanceof CrocMSRP.ContentType) {
					contentType = params.selector.type.toSdpTypeSelector();
				} else {
					contentType = params.selector.type;
				}
				selector = selector.concat('type:', contentType);
			}
			for (var hash in params.selector.hash) {
				if (selector) {
					selector += ' ';
				}
				selector = selector.concat('hash:', hash, ':', params.selector.hash[hash]);
			}
			media.addAttribute('wdcsa', attPrefix.concat(
					'file-selector:', selector));
			media.addAttribute('wdcsa', attPrefix.concat(
					'file-transfer-id:', params.id));
			media.addAttribute('wdcsa', attPrefix.concat(
					'file-disposition:', params.disposition));
			if (params.icon) {
				media.addAttribute('wdcsa', attPrefix.concat(
						'file-icon:', params.icon));
			}
			if (type === 'offer') {
				media.addAttribute('wdcsa', attPrefix + 'sendonly');				
			} else {
				media.addAttribute('wdcsa', attPrefix + 'recvonly');
			}
		}
	};

	DataChannelSession.prototype.sdpUpdate = function(type, attributes) {
		if (!attributes['path'] || !attributes['accept-types']) {
			console.warn('Required SDP attributes missing');
			this.close();
			return;
		}

		// Only process remote SDP once, when setting up the session
		if (this.state !== states.INIT && this.state !== states.AWAIT_SDP) {
			return;
		}

		this.toPath = attributes['path'][0].split(' ');
		this.acceptTypes = attributes['accept-types'][0].split(' ');
		if (attributes['accept-wrapped-types']) {
			this.acceptWrappedTypes = attributes['accept-wrapped-types'][0].split(' ');
		} else {
			this.acceptWrappedTypes = [];
		}

		if (!attributes['setup']) {
			if (type === 'answer') {
				this.active = true;
			}
		} else {
			if (attributes['setup'][0] === 'passive') {
				this.active = true;
			}
		}

		if (this.state === states.AWAIT_SDP) {
			// Data channel is already open, and now we've got the SDP
			if (this.active) {
				// Send the initial message
				changeState(this, states.ESTABLISHED);
			} else {
				// Wait for the initial message
				changeState(this, states.AWAIT_MSG);
			}
		} else {
			// We got the SDP first, wait for the data channel to open
			changeState(this, states.AWAIT_OPEN);
		}
	};

	DataChannelSession.prototype.handleRequest = function(req) {
		// The request's To-Path should have only one URI, and that URI should
		// correspond to this session.
		if (req.toPath.length !== 1) {
			sendResponse(req, this.dataChannel, req.toPath[0], CrocMSRP.Status.SESSION_DOES_NOT_EXIST);
			return;
		}
		if (req.toPath[0] !== this.localUri) {
			sendResponse(req, this.dataChannel, req.toPath[0], CrocMSRP.Status.SESSION_DOES_NOT_EXIST);
			return;
		}

		// Check the request method
		switch (req.method) {
		case 'SEND':
			this.handleSend(req);
			break;
		case 'REPORT':
			this.handleReport(req);
			break;
		default:
			// Unknown method; return 501 as specified in RFC 4975 section 12
			sendResponse(req, this.dataChannel, req.toPath[0], CrocMSRP.Status.NOT_IMPLEMENTED);
			return;
		}
	};
	
	DataChannelSession.prototype.processSendQueue = function() {
		var sent = 0, sender;

		if (this.state !== states.ESTABLISHED) {
			return;
		}

		// If there are outstanding transfers, send up to two further requests.
		// This lets us ramp up the outstanding requests without locking up the
		// application.
		while (this.activeSenders.length > 0 &&
				this.outstandingSends < this.config.maxOutstandingSends &&
				sent < 2) {
			sender = this.activeSenders[0];
			if (sender.aborted && sender.remoteAbort) {
				// Don't send any more chunks; remove sender from list
				this.activeSenders.shift();
			}
			
			var msg = sender.getNextChunk();
			this.dataChannel.send(msg);
			this.outstandingSends++;
			sent++;
			
			// Check whether this sender has now completed
			if (sender.isSendComplete()) {
				// Remove this sender from the active list
				this.activeSenders.shift();
			} else if (this.activeSenders.length > 1) {
				// For fairness, move this sender to the end of the queue
				this.activeSenders.push(this.activeSenders.shift());
			}
		}
	};

	DataChannelSession.prototype.onDcOpen = function() {
		if (this.toPath.length === 0) {
			// Still waiting on the SDP
			changeState(this, states.AWAIT_SDP);
		} else {
			// Already have the SDP, and now the data channel is open
			if (this.active) {
				// Send the initial message
				changeState(this, states.ESTABLISHED);
			} else {
				// Wait for the initial message
				changeState(this, states.AWAIT_MSG);
			}
		}
	};
	
	DataChannelSession.prototype.onDcClose = function() {
		if (this.state !== states.CLOSED) {
			this.dataChannel = null;
			changeState(this, states.CLOSED);
		}
	};
	
	DataChannelSession.prototype.handleSend = function(req) {
		var msgId, description = null, filename = null, size = -1, chunkReceiver;

		try {
			if (req.byteRange.start === 1 &&
					req.continuationFlag === CrocMSRP.Message.Flag.end) {
				// Non chunked message, but check whether it is an empty 'ping'
				if (req.body) {
					// Complete non-chunked, non-empty message

					// These are not required to have a Message-ID; create
					// one if it is not provided.
					msgId = req.messageId || CrocMSRP.util.newMID();
					size = req.byteRange.total;

					if (req.contentDisposition &&
							(req.contentDisposition.type === 'attachment' ||
							req.contentDisposition.type === 'render')) {
						// File transfer, extract any extra details
						description = req.getHeader('content-description');
						filename = req.contentDisposition.param.filename;
					}

					// Fire the appropriate event handlers
					CrocMSRP.util.fireEvent(this, 'onFirstChunkReceived',
							[msgId, req.contentType, filename, size, description],
							true);
					CrocMSRP.util.fireEvent(this, 'onChunkReceived',
							[msgId, size], true);
					CrocMSRP.util.fireEvent(this, 'onMessageReceived',
							[msgId, req.contentType, req.body], true);
				}
			} else {
				// Chunk of a multiple-chunk message
				msgId = req.messageId;
				if (!msgId || !(msgId instanceof String || typeof msgId === 'string')) {
					sendResponse(req, this.dataChannel, this.localUri, CrocMSRP.Status.BAD_REQUEST);
					return;
				}
				
				if (req.byteRange.start === 1 &&
						req.continuationFlag === CrocMSRP.Message.Flag.continued) {
					// First chunk
					chunkReceiver = new CrocMSRP.ChunkReceiver(req, this.config.recvBuffer);
					description = req.getHeader('content-description') || null;
					filename = req.contentDisposition.param.filename || null;

					// The following may throw an UnsupportedMedia exception
					CrocMSRP.util.fireEvent(this, 'onFirstChunkReceived',
							[msgId, req.contentType, filename, req.byteRange.total, description],
							true);

					// The application has not rejected it, so add it to the list of
					// current receivers.
					this.chunkReceivers[msgId] = chunkReceiver;
					
					// Kick off the chunk receiver poll if it's not already running
					if (!this.receiverCheckInterval) {
						var session = this;
						this.receiverCheckInterval = setInterval(
							function() {
								checkReceivers(session);
							}, 1000
						);
					}
				} else {
					// Subsequent chunk
					chunkReceiver = this.chunkReceivers[msgId];
					if (!chunkReceiver) {
						// We assume we will receive chunk one first
						// We could allow out-of-order, but probably not worthwhile
						sendResponse(req, this.dataChannel, this.localUri, CrocMSRP.Status.STOP_SENDING);
						return;
					}
					
					if (!chunkReceiver.processChunk(req)) {
						// Message receive has been aborted
						delete this.chunkReceivers[msgId];

						if (chunkReceiver.remoteAbort) {
							// TODO: what's the appropriate response to an abort?
							sendResponse(req, this.dataChannel, this.localUri, CrocMSRP.Status.STOP_SENDING);
						} else {
							// Notify the far end of the abort
							sendResponse(req, this.dataChannel, this.localUri, CrocMSRP.Status.STOP_SENDING);
						}

						// Notify the application of the abort
						CrocMSRP.util.fireEvent(this, 'onMessageReceiveAborted',
								[msgId, chunkReceiver.blob]);

						return;
					}
				}
					
				if (chunkReceiver.isComplete()) {
					delete this.chunkReceivers[msgId];
					var blob = chunkReceiver.blob;
					CrocMSRP.util.fireEvent(this, 'onMessageReceived',
							[msgId, blob.type, blob], true);
				} else {
					// Receive ongoing
					CrocMSRP.util.fireEvent(this, 'onChunkReceived',
							[msgId, chunkReceiver.receivedBytes], true);
				}
			}
		} catch (e) {
			// Send an error response, but check which status to return
			var status = CrocMSRP.Status.INTERNAL_SERVER_ERROR;
			if (e instanceof CrocMSRP.Exceptions.UnsupportedMedia) {
				status = CrocMSRP.Status.UNSUPPORTED_MEDIA;
			} else {
				console.warn('Unexpected application exception: ' + e.stack);
			}
			sendResponse(req, this.dataChannel, this.localUri, status);
			return;
		}

		if (this.state === states.AWAIT_MSG) {
			changeState(this, states.ESTABLISHED);
		}

		// Send success response
		sendResponse(req, this.dataChannel, this.localUri, CrocMSRP.Status.OK);
		
		// Send REPORT if requested
		if (req.getHeader('success-report') === 'yes') {
			sendReport(this, req);
		}
	};
	
	DataChannelSession.prototype.handleReport = function(report) {
		var msgId, sender;

		msgId = report.messageId;
		if (!msgId) {
			console.log('Invalid REPORT: no message id');
			return;
		}
		
		// Check whether this is for a chunk sender first
		sender = this.chunkSenders[msgId];
		if (!sender) {
			console.log('Invalid REPORT: unknown message id');
			// Silently ignore, as suggested in 4975 section 7.1.2
			return;
		}

		// Let the chunk sender handle the report
		sender.processReport(report);
		if (!sender.isComplete()) {
			// Still expecting more reports, no notification yet
			return;
		}
		
		// All chunks have been acknowledged; clean up
		delete this.chunkSenders[msgId];

		// Don't notify for locally aborted messages
		if (sender.aborted && !sender.remoteAbort) {
			return;
		}
		
		// Notify the application
		if (report.status === CrocMSRP.Status.OK) {
			CrocMSRP.util.fireEvent(this, 'onMessageDelivered', [msgId]);
		} else {
			CrocMSRP.util.fireEvent(this, 'onMessageSendFailed',
					[msgId, report.status, report.comment]);
		}
	};
	
	DataChannelSession.prototype.handleResponse = function(resp) {
		var request = resp.request;
		var msgId;

		// Assume it's a SEND response
		this.outstandingSends--;

		msgId = request.getHeader('message-id');
		if (!msgId) {
			console.log('Can\'t retrieve SEND message id');
			return;
		}

		var sender = request.sender;
		if (resp.status === CrocMSRP.Status.OK) {
			if (!sender.aborted) {
				CrocMSRP.util.fireEvent(this, 'onChunkSent',
						[msgId, request.byteRange.end]);
			}

			if (request.continuationFlag === CrocMSRP.Message.Flag.end) {
				// Notify the application
				CrocMSRP.util.fireEvent(this, 'onMessageSent', [msgId]);
			}
		} else {
			// Failure response
			sender.abort();
			sender.remoteAbort = true;
			// Don't expect any more REPORTs
			delete this.chunkSenders[msgId];
			// Sender will be removed from activeSenders later; needs to send
			// the abort message first.

			// Notify the application
			CrocMSRP.util.fireEvent(this, 'onMessageSendFailed',
					[msgId, resp.status, resp.comment]);
		}
		
		// Then send out any pending requests
		this.processSendQueue();
	};

	DataChannelSession.prototype.handleSenderTimeout = function(msgId) {
		delete this.chunkSenders[msgId];
		// Notify the application
		CrocMSRP.util.fireEvent(this, 'onMessageSendFailed',
				[msgId, CrocMSRP.Status.REQUEST_TIMEOUT, 'Report Timeout']);
	};

	// Private functions
	function changeState(session, state) {
		console.log('Change session state: sessionId=' + session.sessionId + ', old=' + session.state + ', new=' + state);
		session.state = state;

		switch (state) {
		case states.AWAIT_SDP:
			break;
		case states.AWAIT_OPEN:
			break;
		case states.AWAIT_MSG:
			break;
		case states.ESTABLISHED:
			if (session.active) {
				// Complete the session establishment by sending a message
				if (CrocMSRP.util.isEmpty(session.chunkSenders)) {
					// Empty SEND (see RFC 4975 section 5.4 paragraph 3)
					session.send();
				} else {
					session.processSendQueue();
				}
			} else {
				session.processSendQueue();
			}
			break;
		case states.CLOSED:
			session.con.removeSession(session.streamId);
			if (session.dataChannel) {
				session.dataChannel.close();
				session.dataChannel = null;
			}
			break;
		default:
			console.error('Invalid state: ' + state);
			changeState(session, states.CLOSED);
			break;
		}
	}
	
	function sendResponse(req, dc, uri, status) {
		if (status === CrocMSRP.Status.OK) {
			if (!req.responseOn.success) {
				return;
			}
		} else {
			if (!req.responseOn.failure) {
				return;
			}
		}
		
		dc.send(new CrocMSRP.Message.OutgoingResponse(req, uri, status));
	}
	
	function sendReport(session, req) {
		var report;
		
		report = new CrocMSRP.Message.OutgoingRequest(session, 'REPORT');
		report.addHeader('message-id', req.messageId);
		report.addHeader('status', '000 200 OK');

		if (req.byteRange ||
				req.continuationFlag === CrocMSRP.Message.Flag.continued) {
			// A REPORT Byte-Range will be required
			var start = 1, end, total = -1;
			if (req.byteRange) {
				// Don't trust the range end
				start = req.byteRange.start;
				total = req.byteRange.total;
			}
			if (!req.body) {
				end = 0;
			} else if (req.body instanceof ArrayBuffer) {
				// Yay! Binary frame: the length is obvious.
				end = start + req.body.byteLength - 1;
			} else {
				// Boo. Text frame: turn it back into UTF-8 and cross your fingers
				// that the resulting bytes (and length) are what they should be.
				var blob = new Blob([req.body]);
				end = start + blob.size - 1;
				// blob.close();
			}
			
			if (end !== req.byteRange.end) {
				console.warn('Report Byte-Range end does not match request');
			}
			
			report.byteRange = {'start': start, 'end': end, 'total': total};
		}
		
		session.dataChannel.send(report);
	}
	
	function checkReceivers(session) {
		var msgId, receiver,
			now = new Date().getTime(),
			timeout = session.config.chunkTimeout;
		for (msgId in session.chunkReceivers) {
			receiver = session.chunkReceivers[msgId];
			if (now - receiver.lastReceive > timeout) {
				// Clean up the receiver
				receiver.abort();
				delete session.chunkReceivers[msgId];
				CrocMSRP.util.fireEvent(this, 'onMessageReceiveTimeout',
						[msgId, receiver.blob]);
			}
		}
		
		if (CrocMSRP.util.isEmpty(session.chunkReceivers)) {
			clearInterval(session.receiverCheckInterval);
			session.receiverCheckInterval = null;
		}
	}

	CrocMSRP.DataChannelSession = DataChannelSession;

	return CrocMSRP;
}(CrocMSRP || {}));
