/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var reconnectTimeout = 10000;
	
	/**
	 * Creates a new connection.
	 * A single connection can support multiple sessions. The
	 * websocket connection is not actually opened until the first session
	 * is created.
	 * @class Represents a single connection to a websocket MSRP relay.
	 */
	function RelayConnection(relayWsUri, relayMsrpUri, config) {
		var option, defaultConfig = new CrocMSRP.ConnectionConfig();

		// Process any optional configuration options
		if (config) {
			// Copy in defaults for any missing options
			for (option in defaultConfig) {
				if (config[option] === undefined) {
					config[option] = defaultConfig[option];
				}
			}
		} else {
			// Use the defaults
			config = defaultConfig;
		}
		// Add required configuration options
		config.relayWsUri = relayWsUri;
		config.relayMsrpUri = relayMsrpUri;
		this.config = config;
		
		this.ws = null;
		this.localSessionIds = {};
		this.reconnectTimer = null;
		
		// An array of active message senders
		this.activeSenders = [];
		// The count of outstanding sends
		this.outstandingSends = 0;
	}

	/**
	 * Connects to the websocket server.
	 * @private
	 */
	RelayConnection.prototype.connect = function() {
		if (!this.ws) {
			this.ws = new CrocMSRP.WSWrapper(this, this.config.relayWsUri);
		}
	};

	/**
	 * Creates a new session that uses this connection.  Sessions created using
	 * this method can be used to create an outgoing chat SDP offer, or accept
	 * incoming chat or file transfer SDP offers.  To create an outgoing file
	 * transfer SDP offer, use
	 * {@link CrocMSRP.Connection#createFileTransferSession} instead.
	 * Note: The websocket connection is only opened after the first session has
	 * been created.
	 * @param {CrocMSRP.Events} eventObj An object containing event callbacks
	 * to use for the new session.
	 */
	RelayConnection.prototype.createSession = function(eventObj) {
		var sessionId, localUri;
		
		do {
			sessionId = CrocMSRP.util.newSID();
		} while (this.localSessionIds[sessionId]);
		
		localUri = new CrocMSRP.Uri();
		localUri.secure = (this.config.relayWsUri.substr(0, 3) === 'wss');
		localUri.authority = this.config.authority;
		localUri.port = 2855;
		localUri.sessionId = sessionId;
		localUri.transport = 'ws';
		this.localSessionIds[sessionId] = new CrocMSRP.Session(this, sessionId, localUri, eventObj);
		
		if (!this.ws) {
			this.connect();
		} else if (this.ws.isConnected()) {
			// Immediately start the authentication process
			this.localSessionIds[sessionId].onWsConnect();
		}
		
		return this.localSessionIds[sessionId];
	};
	
	/**
	 * Creates a new session that uses this connection.  Sessions created using
	 * this method can be used to create an outgoing file transfer SDP offer (as
	 * per RFC 5547).  For other sessions, use
	 * {@link CrocMSRP.Connection#createSession} instead.
	 * Note: The websocket connection is only opened after the first session has
	 * been created.
	 * @param {CrocMSRP.Events} eventObj An object containing event callbacks
	 * to use for the new session.
	 * @param {File} file The file that will be sent using this session.
	 * @param {CrocMSRP.FileParams} [params] Optional file parameters that may
	 * influence the construction of the SDP offer.
	 */
	RelayConnection.prototype.createFileTransferSession = function(eventObj, file, params) {
		var session = this.createSession(eventObj);
		session.file = file;
		session.fileParams = params || {};
		return session;
	};

	/**
	 * Closes all sessions associated with this connection and  closes the
	 * websocket connection.
	 */
	RelayConnection.prototype.disconnect = function() {
		var sessionId;
		for (sessionId in this.localSessionIds) {
			this.localSessionIds[sessionId].close();
		}
		// Socket will be closed when the last session notifies us of closure
	};

	// Internal Events
	RelayConnection.prototype.onWsConnect = function() {
		var sessionId;
		// Notify sessions to kick off authentication process
		for (sessionId in this.localSessionIds) {
			this.localSessionIds[sessionId].onWsConnect();
		}
	};

	RelayConnection.prototype.onWsError = function() {
		var sessionId;
		// Ungraceful disconnect
		console.log('WS Error');
		if (this.ws && !CrocMSRP.util.isEmpty(this.localSessionIds)) {
			// If there are sessions present, start a timer to reconnect
			var con = this;
			this.reconnectTimer = setTimeout(
				function() {
					con.connect();
				}, reconnectTimeout);
		}
		this.ws = null;
		this.outstandingSends = 0;
		for (sessionId in this.localSessionIds) {
			this.localSessionIds[sessionId].onWsError();
		}
	};

	RelayConnection.prototype.onWsDisconnect = function() {
		// Graceful disconnect (on request)
		console.log('WS Disconnected');
		this.ws = null;
		this.outstandingSends = 0;
	};

	RelayConnection.prototype.removeSession = function(sessionId) {
		delete this.localSessionIds[sessionId];
		if (CrocMSRP.util.isEmpty(this.localSessionIds)) {
			// No more sessions; close the connection
			if (this.ws) {
				this.ws.disconnect();
			}
		}
	};

	RelayConnection.prototype.onMsrpRequest = function(req) {
		var toUri, session;
		
		// The request's To-Path should have only one URI, and that URI should
		// correspond to one of our sessions.
		if (req.toPath.length !== 1) {
			sendResponse(req, this, req.toPath[0], CrocMSRP.Status.SESSION_DOES_NOT_EXIST);
			return;
		}
		// Decode the URI
		toUri = new CrocMSRP.Uri(req.toPath[0]);
		if (!toUri) {
			sendResponse(req, this, req.toPath[0], CrocMSRP.Status.BAD_REQUEST);
			return;
		}
		// Lookup the appropriate session
		session = this.localSessionIds[toUri.sessionId];
		if (!session || !session.localUri.equals(toUri)) {
			sendResponse(req, this, req.toPath[0], CrocMSRP.Status.SESSION_DOES_NOT_EXIST);
			return;
		}

		// Check the request method
		switch (req.method) {
		case 'SEND':
			session.onIncomingSend(req);
			break;
		case 'REPORT':
			session.onIncomingReport(req);
			break;
		default:
			// Unknown method; return 501 as specified in RFC 4975 section 12
			sendResponse(req, this, req.toPath[0], CrocMSRP.Status.NOT_IMPLEMENTED);
			return;
		}
	};
	
	RelayConnection.prototype.addSender = function(sender) {
		this.activeSenders.push(sender);
		sendRequests(this);
	};
	
	RelayConnection.prototype.onMsrpResponse = function(res) {
		if (res.request.method === 'SEND') {
			this.outstandingSends--;
		}
		
		// Let the sending session handle the response
		res.request.session.onIncomingResponse(res);
		
		// Then send out any pending requests
		sendRequests(this);
	};
	
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

	function sendRequests(con) {
		var sent = 0, sender;
		
		// If there are outstanding transfers, send up to two further requests.
		// This lets us ramp up the outstanding requests without locking up the
		// application.
		while (con.activeSenders.length > 0 &&
				con.outstandingSends < con.config.maxOutstandingSends &&
				sent < 2) {
			sender = con.activeSenders[0];
			if (sender.aborted && sender.remoteAbort) {
				// Don't send any more chunks; remove sender from list
				con.activeSenders.shift();
			}
			
			var msg = sender.getNextChunk();
			con.ws.send(msg);
			con.outstandingSends++;
			sent++;
			
			// Check whether this sender has now completed
			if (sender.isSendComplete()) {
				// Remove this sender from the active list
				con.activeSenders.shift();
			} else if (con.activeSenders.length > 1) {
				// For fairness, move this sender to the end of the queue
				con.activeSenders.push(con.activeSenders.shift());
			}
		}
	}

	// Old name, for backwards compatibility
	CrocMSRP.Connection = RelayConnection;
	CrocMSRP.RelayConnection = RelayConnection;

	return CrocMSRP;
}(CrocMSRP || {}));

