/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var states;

	// Private stuff
	states = {
		AWAIT_CONNECT: 0,
		AWAIT_CHALLENGE: 1,
		AWAIT_AUTH_RES: 2,
		AWAIT_SDP: 3,
		ESTABLISHED: 4,
		ERROR: 5,            // Final state: unrecoverable errors only
		CLOSED: 6
	};
	
	/**
	 * Creates a new Session object.
	 * Note: Session objects should not be created directly. To create a new
	 * session, use {@link CrocMSRP.Connection#createSession}.
	 * @class Represents an MSRP session with a single endpoint via the websocket relay.
	 * A single connection can host many simultaneous sessions.
	 */
	CrocMSRP.Session = function(con, sessionId, localUri, eventObj) {
		var index;
		
		// Check for mandatory methods on the event object
		if (!eventObj) {
			throw 'Event object required';
		}
		for (index in CrocMSRP.mandatoryEvents) {
			if (!eventObj[CrocMSRP.mandatoryEvents[index]]) {
				throw 'Event object missing mandatory event: ' +
					CrocMSRP.mandatoryEvents[index];
			}
		}
		
		// The connection used by this session
		this.con = con;
		// Local reference to the config object
		this.config = con.config;
		// The session ID (as used in the local URI)
		this.sessionId = sessionId;
		// The local endpoint URI for this session
		this.localUri = localUri;
		// The To-Path header for outgoing requests (set later)
		this.toPath = [];
		// The event notification object provided by the parent application
		this.eventObj = eventObj;
		
		initAuth(this);
		
		// Stuff for the SDP
		this.sdpSessId = CrocMSRP.util.dateToNtpTime(new Date());
		this.sdpSessVer = this.sdpSessId;
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

		// Initialise the session state - after this, everything should use
		// the changeState() function instead.
		this.state = states.AWAIT_CONNECT;
		this.established = false;
		/**
		 * The FileParams object describing the file being transferred in this
		 * session. For outgoing file transfers, this can be provided as a
		 * parameter when creating the session. For incoming transfers, this
		 * is populated when the incoming SDP offer is parsed.
		 * @type CrocMSRP.FileParams
		 * @see CrocMSRP.Connection#createFileTransferSession
		 * @see CrocMSRP.Session#getSdpAnswer
		 */
		this.fileParams = null;
	};

	// Public functions
	/**
	 * Creates an SDP offer for this session.
	 * @returns {String} The SDP offer. If an error is encountered, the return
	 * value will be null.
	 */
	CrocMSRP.Session.prototype.getSdpOffer = function() {
		var sdp, media;

		// Make sure we're in an appropriate state to construct the SDP
		switch (this.state) {
		case states.AWAIT_SDP:
		case states.ESTABLISHED:
			break;
		default:
			return null;
		}
		
		// Prepare the SDP media 'line' for the MSRP session
		media = new CrocMSRP.Sdp.Media();
		media.port = this.localUri.port;
		media.proto = (this.localUri.secure) ? 'TCP/TLS/MSRP' : 'TCP/MSRP';
		media.attributes['accept-types'] = this.config.acceptTypes.join(' ');
		if (this.config.acceptWrappedTypes && this.config.acceptWrappedTypes.length > 0) {
			media.attributes['accept-wrapped-types'] = this.config.acceptWrappedTypes.join(' ');
		}
		media.attributes['path'] = this.relayPath.slice().reverse().join(' ') + ' ' + this.localUri;
		
		if (this.file) {
			// This is an outgoing file transfer session; add extra SDP
			// attributes as per RFC 5547.
			var params = this.fileParams,
				selector = '',
				hash;
			
			params.selector = params.selector || {};
			// One of the following MUST be present for the file-selector
			params.selector.name = params.selector.name || this.file.name;
			params.selector.size = params.selector.size || this.file.size;
			params.selector.type = params.selector.type || this.file.type;
			params.selector.hash = params.selector.hash || {};
			
			params.id = params.id || CrocMSRP.util.newFileTransferId();
			params.disposition = params.disposition || 'render';
			
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
				var type;
				if (selector) {
					selector += ' ';
				}
				if (params.selector.type instanceof CrocMSRP.ContentType) {
					type = params.selector.type.toSdpTypeSelector();
				} else {
					type = params.selector.type;
				}
				selector = selector.concat('type:', type);
			}
			for (hash in params.selector.hash) {
				if (selector) {
					selector += ' ';
				}
				selector = selector.concat('hash:', hash, ':', params.selector.hash[hash]);
			}
			media.attributes['file-selector'] = selector;
			media.attributes['file-transfer-id'] = params.id;
			media.attributes['file-disposition'] = params.disposition;
			if (params.icon) {
				media.attributes['file-icon'] = params.icon;
			}
			media.attributes['sendonly'] = null;
		}
		
		// Construct the entire SDP message, appending the media 'line'
		sdp = new CrocMSRP.Sdp.Session();
		sdp.origin.username = this.config.username;
		sdp.origin.id = this.sdpSessId;
		sdp.origin.version = this.sdpSessVer;
		sdp.origin.address = this.config.authority;
		sdp.connection.address = this.config.authority;
		sdp.media.push(media);
		
		// No state change: we need the answer to finish establishing the session
		return sdp.toString();
	};
	
	/**
	 * Processes an SDP answer for this session.
	 * @param {String} answer The raw SDP answer received from the far end.
	 * @returns {String} The Message-ID of the initial session establishment
	 * message (an empty "ping" message, unless a message or file was provided
	 * when the session was created).  If an error was encountered, the return
	 * value will be null.
	 */
	CrocMSRP.Session.prototype.processSdpAnswer = function(answer) {
		var index, media, sender, msgId;
		
		switch (this.state) {
		case states.AWAIT_SDP:
		case states.ESTABLISHED:
			break;
		default:
			return null;
		}
		
		answer = new CrocMSRP.Sdp.Session(answer);
		if (!answer) {
			return null;
		}
		
		for (index in answer.media) {
			media = answer.media[index];
			
			if (media.media === 'message' && media.port !== 0 &&
					media.attributes['path'] && media.attributes['accept-types']) {
				this.farEndPath = media.attributes['path'].split(' ');
				this.toPath = this.relayPath.concat(this.farEndPath);
				this.acceptTypes = media.attributes['accept-types'].split(' ');
				if (media.attributes['accept-wrapped-types']) {
					this.acceptWrappedTypes = media.attributes['accept-wrapped-types'].split(' ');
				} else {
					this.acceptWrappedTypes = [];
				}
				changeState(this, states.ESTABLISHED);

				if (CrocMSRP.util.isEmpty(this.chunkSenders)) {
					// Complete the session establishment by sending a message
					var session = this;
					if (this.file) {
						// This is a file transfer session; start sending the file
						var params = this.fileParams;
						sender = new CrocMSRP.ChunkSender(this, this.file,
							params.selector.type, params.disposition,
							params.description);
					} else {
						// Empty SEND (see RFC 4975 section 5.4 paragraph 3)
						sender = new CrocMSRP.ChunkSender(this, null);
					}
				
					sender.onReportTimeout = makeTimeoutHandler(session, sender.messageId);
					this.con.addSender(sender);
					this.chunkSenders[sender.messageId] = sender;
					return sender.messageId;
				}

				// Return message ID of the first existing ongoing message sender
				for (msgId in this.chunkSenders) {
					return msgId;
				}
			}
		}
		
		return null;
	};
	
	/**
	 * Creates an SDP answer for this session, given an appropriate offer.
	 * Note: before returning the answer, the application should confirm that
	 * it understands at least one of the MIME types offered by the far end;
	 * otherwise it should return a suitable error response (e.g. SIP 488).
	 * If the incoming SDP offer is for an incoming file transfer, the
	 * {@link CrocMSRP.Session.fileParams} property will be populated. The
	 * application should confirm that it wishes to receive the described
	 * file; otherwise a suitable error response should be returned.
	 * @param {String} offer The raw SDP offer received from the far end.
	 * @returns {String} The SDP answer. If an error is encountered, the return
	 * value will be null.
	 */
	CrocMSRP.Session.prototype.getSdpAnswer = function(offer) {
		var answer, index, media, suitableMediaFound = false;
		
		switch (this.state) {
		case states.AWAIT_SDP:
		case states.ESTABLISHED:
			break;
		default:
			return null;
		}

		// Start with the offer
		answer = new CrocMSRP.Sdp.Session(offer);
		if (!answer) {
			return null;
		}
		
		// Update the origin
		answer.origin.username = this.config.username;
		answer.origin.id = this.sdpSessId;
		answer.origin.version = this.sdpSessVer;
		answer.origin.address = this.config.authority;
		
		// If connection is present, update it
		if (answer.connection) {
			answer.connection.address = this.config.authority;
		}
		
		// Find and process the first MSRP media we recognise; reject everything else
		for (index in answer.media) {
			media = answer.media[index];
			
			if (!suitableMediaFound && media.media === 'message' && media.port !== 0 &&
					(media.proto === 'TCP/MSRP' || media.proto === 'TCP/TLS/MSRP') &&
					media.attributes['path'] && media.attributes['accept-types']) {
				// Process the SDP attributes we need
				this.farEndPath = media.attributes['path'].split(' ');
				this.toPath = this.relayPath.concat(this.farEndPath);
				this.acceptTypes = media.attributes['accept-types'].split(' ');
				if (media.attributes['accept-wrapped-types']) {
					this.acceptWrappedTypes = media.attributes['accept-wrapped-types'].split(' ');
				} else {
					this.acceptWrappedTypes = [];
				}
				if (media.attributes['file-selector']) {
					// Incoming file transfer: extract provided info so the
					// application/user can make an informed decision on
					// whether or not to accept the file.
					this.fileParams = CrocMSRP.Sdp.parseFileAttributes(media);
					delete media.attributes['sendonly'];
					media.attributes['recvonly'] = null;
				}
				changeState(this, states.ESTABLISHED);
				suitableMediaFound = true;
				
				// Now set the media answer values
				media.port = this.localUri.port;
				media.proto = (this.localUri.secure) ? 'TCP/TLS/MSRP' : 'TCP/MSRP';
				media.attributes['accept-types'] = this.config.acceptTypes.join(' ');
				if (this.config.acceptWrappedTypes &&
						this.config.acceptWrappedTypes.length > 0) {
					media.attributes['accept-wrapped-types'] =
						this.config.acceptWrappedTypes.join(' ');
				} else {
					delete media.attributes['accept-wrapped-types'];
				}
				media.attributes['path'] = this.relayPath.slice().reverse().join(' ') + ' ' + this.localUri;
			} else {
				media.port = 0;
			}
		}
		
		return answer.toString();
	};
	
	/**
	 * Sends a message (or file) over an established session.
	 * @param {String|Blob|File} body The message body to send (may be binary
	 * data/file).
	 * @param {String} [contentType] The MIME type of the provided body.
	 * @returns {String} The Message-ID of the sent message. This can be used
	 * to correlate notifications with the appropriate message.
	 */
	CrocMSRP.Session.prototype.send = function(body, contentType) {
		var type, sender, session = this;
		if (!this.established) {
			throw 'Unable to send, session not yet established';
		}
		
		// Determine content type & size
		if (body instanceof String || typeof body === 'string') {
			type = contentType || 'text/plain';
		} else if (body instanceof Blob) {
			type = contentType || body.type || 'application/octet-stream';
		}
		
		sender = new CrocMSRP.ChunkSender(this, body, type);
		sender.onReportTimeout = makeTimeoutHandler(session, sender.messageId);
		this.con.addSender(sender);
		this.chunkSenders[sender.messageId] = sender;

		return sender.messageId;
	};
	
	/**
	 * Aborts an ongoing message receive.
	 * @param {String} [id] The ID of the message to abort.  If this is
	 * not specified then all incoming messages will be aborted.
	 */
	CrocMSRP.Session.prototype.abortReceive = function(id) {
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
	CrocMSRP.Session.prototype.abortSend = function(id) {
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
	CrocMSRP.Session.prototype.close = function() {
		this.abortFileReceive();
		this.abortFileSend();
		changeState(this, states.CLOSED);
	};

	// Internal events
	CrocMSRP.Session.prototype.onWsConnect = function() {
		sendAuth(this);
	};
	
	CrocMSRP.Session.prototype.onWsError = function() {
		// Wait for a new connection
		changeState(this, states.AWAIT_CONNECT);
	};
	
	CrocMSRP.Session.prototype.onIncomingSend = function(req) {
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
						// Single chunk file transfer
						// For consistency, files are always provided as blobs
						chunkReceiver = new CrocMSRP.ChunkReceiver(req, this.config.recvBuffer);
						description = req.getHeader('content-description');
						filename = req.contentDisposition.param.filename;
				
						this.eventObj.onFirstChunkReceived(msgId, req.contentType,
							filename, size, description);
						if (this.eventObj.onChunkReceived) {
							this.eventObj.onChunkReceived(msgId,
								chunkReceiver.receivedBytes);
						}
						this.eventObj.onMessageReceived(msgId,
								chunkReceiver.blob.type, chunkReceiver.blob);
					} else {
						// Single chunk message
						this.eventObj.onFirstChunkReceived(msgId, req.contentType,
								filename, size, description);
						if (this.eventObj.onChunkReceived) {
							this.eventObj.onChunkReceived(msgId, size);
						}
						this.eventObj.onMessageReceived(msgId, req.contentType,
								req.body);
					}
				}
			} else {
				// Chunk of a multiple-chunk message
				msgId = req.messageId;
				if (!msgId || !(msgId instanceof String || typeof msgId === 'string')) {
					sendResponse(req, this.con, this.localUri, CrocMSRP.Status.BAD_REQUEST);
					return;
				}
				
				if (req.byteRange.start === 1 &&
						req.continuationFlag === CrocMSRP.Message.Flag.continued) {
					// First chunk
					chunkReceiver = new CrocMSRP.ChunkReceiver(req, this.config.recvBuffer);
					description = req.getHeader('content-description') || null;
					filename = req.contentDisposition.param.filename || null;

					// The following may throw an UnsupportedMedia exception
					this.eventObj.onFirstChunkReceived(msgId, req.contentType,
						filename, req.byteRange.total, description);

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
						sendResponse(req, this.con, this.localUri, CrocMSRP.Status.STOP_SENDING);
						return;
					}
					
					if (!chunkReceiver.processChunk(req)) {
						// Message receive has been aborted
						delete this.chunkReceivers[msgId];

						if (chunkReceiver.remoteAbort) {
							// TODO: what's the appropriate response to an abort?
							sendResponse(req, this.con, this.localUri, CrocMSRP.Status.STOP_SENDING);
						} else {
							// Notify the far end of the abort
							sendResponse(req, this.con, this.localUri, CrocMSRP.Status.STOP_SENDING);
						}

						// Notify the application of the abort
						try {
							this.eventObj.onMessageReceiveAborted(msgId, chunkReceiver.blob);
						} catch (e) {
							console.log('Unexpected application exception: ' + e);
						}

						return;
					}
				}
					
				if (chunkReceiver.isComplete()) {
					delete this.chunkReceivers[msgId];
					var blob = chunkReceiver.blob;
					this.eventObj.onMessageReceived(msgId, blob.type, blob);
				} else {
					// Receive ongoing
					if (this.eventObj.onChunkReceived) {
						this.eventObj.onChunkReceived(msgId, chunkReceiver.receivedBytes);
					}
				}
			}
		} catch (e) {
			// Send an error response, but check which status to return
			var status = CrocMSRP.Status.INTERNAL_SERVER_ERROR;
			if (e instanceof CrocMSRP.Exceptions.UnsupportedMedia) {
				status = CrocMSRP.Status.UNSUPPORTED_MEDIA;
			} else {
				console.log('Unexpected application exception: ' + e);
			}
			sendResponse(req, this.con, this.localUri, status);
			return;
		}

		// Send success response
		sendResponse(req, this.con, this.localUri, CrocMSRP.Status.OK);
		
		// Send REPORT if requested
		if (req.getHeader('success-report') === 'yes') {
			sendReport(this, req);
		}
	};
	
	CrocMSRP.Session.prototype.onIncomingReport = function(report) {
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
		try {
			if (report.status === CrocMSRP.Status.OK) {
				if (this.eventObj.onMessageDelivered) {
					this.eventObj.onMessageDelivered(msgId);
				}
			} else {
				this.eventObj.onMessageSendFailed(msgId, report.status, report.comment);
			}
		} catch (e) {
			console.log('Unexpected application exception: ' + e);
		}
	};
	
	CrocMSRP.Session.prototype.onIncomingResponse = function(resp) {
		var msgId;

		if (resp.request.method === 'AUTH') {
			switch (resp.status) {
			case CrocMSRP.Status.UNAUTHORIZED:
				if (this.state === states.AWAIT_AUTH_RES) {
					// Another challenge - treat as a failure
					changeState(this, states.AUTH_FAILED);
				} else {
					sendAuth(this, resp);
				}
				break;
			case CrocMSRP.Status.OK:
				processAuthRes(this, resp);
				break;
			case CrocMSRP.Status.INTERVAL_OUT_OF_BOUNDS:
				// Expires header out-of-bounds, set to the min/max
				this.config.authExpires = resp.expires;
				// Try again
				sendAuth(this);
				break;
			default:
				changeState(this, states.AUTH_FAILED);
				break;
			}
			return;
		}
		
		// Otherwise it's a SEND response
		msgId = resp.request.getHeader('message-id');
		if (!msgId) {
			console.log('Can\'t retrieve SEND message id');
			return;
		}

		var sender = resp.request.sender;
		if (resp.status === CrocMSRP.Status.OK) {
			try {
				if (!sender.aborted && this.eventObj.onChunkSent) {
					this.eventObj.onChunkSent(msgId, resp.request.byteRange.end);
				}

				if (resp.request.continuationFlag === CrocMSRP.Message.Flag.end &&
						this.eventObj.onMessageSent) {
					// Notify the application
					this.eventObj.onMessageSent(msgId);
				}
			} catch (e) {
				console.log('Unexpected application exception: ' + e);
			}
		} else {
			// Failure response
			sender.abort();
			sender.remoteAbort = true;
			// Don't expect any more REPORTs
			delete this.chunkSenders[msgId];
			// Sender will be removed from Connection.activeSenders later

			// Notify the application
			try {
				this.eventObj.onMessageSendFailed(msgId, resp.status, resp.comment);
			} catch (e) {
				console.log('Unexpected application exception: ' + e);
			}
		}
	};
	
	// Private functions
	function makeTimeoutHandler(session, msgId) {
		return function() {
			delete session.chunkSenders[msgId];
			// Notify the application
			try {
				session.eventObj.onMessageSendFailed(msgId, CrocMSRP.Status.REQUEST_TIMEOUT, 'Report Timeout');
			} catch (e) {
				console.log('Unexpected application exception: ' + e);
			}
		};
	}

	function changeState(session, state) {
		console.log('Change session state: sessionId=' + session.sessionId + ', old=' + session.state + ', new=' + state);
		session.state = state;

		switch (state) {
		case states.AWAIT_CONNECT:
			session.established = false;
			initAuth(session);
			break;
		case states.AWAIT_CHALLENGE:
		case states.AWAIT_AUTH_RES:
			// May remain established whilst reauthenticating
			break;
		case states.AWAIT_SDP:
			// May remain established whilst reauthenticating
			session.sdpSessVer = CrocMSRP.util.dateToNtpTime(new Date());
			try {
				session.eventObj.onAuthenticated();
			} catch (e) {
				console.log('Unexpected application exception: ' + e);
			}
			break;
		case states.ESTABLISHED:
			if (!session.established && !CrocMSRP.util.isEmpty(this.chunkSenders)) {
				// Resume outgoing transfers from the acknowledged position
				var msgId;
				for (msgId in this.chunkSenders) {
					this.chunkSenders[msgId].resume();
				}
			}
			session.established = true;
			// Nothing to do here
			break;
		case states.AUTH_FAILED:
			session.established = false;
			initAuth(session);
			try {
				session.eventObj.onAuthFailed();
			} catch (e) {
				console.log('Unexpected application exception: ' + e);
			}
			session.con.removeSession(session.sessionId);
			break;
		case states.ERROR:
			session.established = false;
			initAuth(session);
			try {
				session.eventObj.onError();
			} catch (e) {
				console.log('Unexpected application exception: ' + e);
			}
			session.con.removeSession(session.sessionId);
			break;
		case states.CLOSED:
			session.established = false;
			initAuth(session);
			session.con.removeSession(session.sessionId);
			break;
		default:
			console.error('Invalid state: ' + state);
			changeState(session, states.ERROR);
			break;
		}
	}
	
	function initAuth(session) {
		// (re)Initialise any properties used by the authentication process

		// Clear the auth timer if it's running
		if (session.authTimer) {
			clearTimeout(session.authTimer);
			session.authTimer = null;
		}
		// As we receive relay URIs they will be appended here, and the toPath reconstructed
		session.relayPath = [];
		// Once SDP negotiation has provided the far end path, it will be stored
		// here, and appended to the toPath.
		session.farEndPath = [];
	}
	
	function sendAuth(session, resp) {
		var authReq;
		
		authReq = new CrocMSRP.Message.OutgoingRequest(session, 'AUTH');
		
		// Override the To-Path of the request
		authReq.toPath = [session.config.relayMsrpUri];

		if (resp) {
			var index, authorisation = null;
				
			if (!resp.authenticate) {
				console.log('Auth failed: no WWW-Authenticate header available');
				changeState(session, states.ERROR);
				return;
			}
			
			for (index in resp.authenticate) {
				authorisation = CrocMSRP.digestAuthentication(session.config,
					resp.request, resp.authenticate[index]);
				if (authorisation) {
					break;
				}
			}
			
			if (!authorisation || authorisation.length === 0) {
				console.log('Construction of authorization failed');
				changeState(session, states.ERROR);
				return;
			}
			
			authReq.addHeader('authorization', authorisation);
			changeState(session, states.AWAIT_AUTH_RES);
		} else {
			changeState(session, states.AWAIT_CHALLENGE);
		}
		
		if (session.config.authExpires) {
			// Set the requested auth duration
			authReq.addHeader('expires', session.config.authExpires);
		}
		
		session.con.ws.send(authReq);
	}

	function processAuthRes(session, resp) {
		if (!resp.usePath) {
			console.log('Use-Path header missing!');
			changeState(session, states.ERROR);
			return;
		}
		
		session.relayPath = resp.usePath;
		session.authTimer = setTimeout(
			function() {
				session.authTimer = null;
				initAuth(session);
				sendAuth(session);
			}, (resp.expires - 30) * 1000);
		
		changeState(session, states.AWAIT_SDP);
	}
	
	function sendResponse(req, con, uri, status) {
		if (status === CrocMSRP.Status.OK) {
			if (!req.responseOn.success) {
				return;
			}
		} else {
			if (!req.responseOn.failure) {
				return;
			}
		}
		
		con.ws.send(new CrocMSRP.Message.OutgoingResponse(req, uri, status));
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
		
		session.con.ws.send(report);
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
				try {
					session.eventObj.onMessageReceiveTimeout(msgId, receiver.blob);
				} catch (e) {
					console.log('Unexpected application exception: ' + e);
				}
			}
		}
		
		if (CrocMSRP.util.isEmpty(session.chunkReceivers)) {
			clearInterval(session.receiverCheckInterval);
			session.receiverCheckInterval = null;
		}
	}
	
	return CrocMSRP;
}(CrocMSRP || {}));

