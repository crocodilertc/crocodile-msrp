/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var states;
	
	states = {
		INIT: 0,
		CONNECTING: 1,
		CONNECTED: 2,
		ERROR: 3,
		DISCONNECTING: 4,
		DISCONNECTED: 5
	};
	
	CrocMSRP.WSWrapper = function(con, relayUri) {
		this.con = con;
		this.relayUri = relayUri;

		this.state = states.INIT;

		this.ws = null;
		// Object for tracking outstanding transaction IDs (for sent requests)
		this.transactions = {};
		
		this.connect();
	};

	CrocMSRP.WSWrapper.prototype.isConnected = function() {
		return this.state === states.CONNECTED;
	};

	CrocMSRP.WSWrapper.prototype.connect = function() {
		var ws, wrapper = this;

		this.state = states.CONNECTING;
		console.log("Attempting WebSocket Connection to " + this.relayUri);
		
		try {
			ws = new WebSocket(this.relayUri, 'msrp');
		} catch (e) {
			console.log("Connection error: " + e);
			return false;
		}
		
		// We expect relatively small messages, so hint to keep in memory
		ws.binaryType = "arraybuffer";
		
		// Register callbacks
		ws.onopen = function(e) { wrapper.onOpen(e); };
		ws.onerror = function(e) { wrapper.onError(e); };
		ws.onclose = function(e) { wrapper.onClose(e); };
		ws.onmessage = function(e) { wrapper.onMessage(e); };
		
		this.running = true;
		this.ws = ws;
		
		return true;
	};

	CrocMSRP.WSWrapper.prototype.disconnect = function() {
		this.state = states.DISCONNECTING;
		if (this.ws) {
			this.ws.close();
		}
	};

	CrocMSRP.WSWrapper.prototype.send = function(message) {
		var wsWrapper = this;
		if (this.state !== states.CONNECTED || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.log("Send failed: socket not ready");
			return false;
		}
		
		if (message instanceof CrocMSRP.Message.Request && message.method !== 'REPORT') {
			message.timer = setTimeout(function(){timeout(wsWrapper, message);}, 30000);
			this.transactions[message.tid] = message;
		}
		
		try {
			this.ws.send(message.encode());
		} catch (e) {
			console.log("Send failed: " + e);
			return false;
		}
		
		return true;
	};

	CrocMSRP.WSWrapper.prototype.onOpen = function() {
		this.state = states.CONNECTED;
		this.con.onWsConnect();
	};

	CrocMSRP.WSWrapper.prototype.onError = function() {
		// This should be followed by onClose, so don't need to do much here
		this.state = states.ERROR;
		console.log('WebSocket error');
	};

	CrocMSRP.WSWrapper.prototype.onClose = function(event) {
		if (this.state === states.DISCONNECTING) {
			// Report the successful disconnect
			this.con.onWsDisconnect();
		} else {
			console.warn("WebSocket closed unexpectedly: wasClean=" + event.wasClean + " code=" + event.code);
			// Report the failure
			this.con.onWsError();
		}
		this.state = states.DISCONNECTED;
	};

	CrocMSRP.WSWrapper.prototype.onMessage = function(event) {
		// Parse MSRP message
		var msg = CrocMSRP.parseMessage(event.data);
		if (!msg) {
			// Oh dear
			this.state = states.ERROR;
			console.log('MSRP message parsing error; closing websocket');
			this.ws.close();
			return;
		}
		
		if (msg instanceof CrocMSRP.Message.Response) {
			// Check for outstanding transaction
			msg.request = this.transactions[msg.tid];
			if (msg.request) {
				clearTimeout(msg.request.timer);
				delete msg.request.timer;
				delete this.transactions[msg.tid];
				this.con.onMsrpResponse(msg);
			} else {
				console.log("Unexpected response received; not in transaction list");
			}
			return;
		}
		
		// Send requests up to the con
		this.con.onMsrpRequest(msg);
	};

	function timeout(wsWrapper, request) {
		delete request.timer;
		delete wsWrapper.transactions[request.tid];
		var resp = new CrocMSRP.Message.IncomingResponse(request.tid, 408, CrocMSRP.StatusComment[408]);
		resp.request = request;
		wsWrapper.con.onMsrpResponse(resp);
	}
	
	return CrocMSRP;
}(CrocMSRP || {}));

