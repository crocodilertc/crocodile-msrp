/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	function DCWrapper(session, dataChannel) {
		this.session = session;
		this.dataChannel = dataChannel;

		// Object for tracking outstanding transaction IDs (for sent requests)
		this.transactions = {};
		
		this.initDc();
	}

	DCWrapper.prototype.initDc = function() {
		var dc = this.dataChannel;
		var self = this;

		// We expect relatively small messages, so hint to keep in memory
		dc.binaryType = "arraybuffer";
		
		// Register callbacks
		dc.onopen = function() {
			self.session.onDcOpen();
		};
		dc.onclose = function() {
			self.session.onDcClose();
		};
		dc.onmessage = function(e) {
			self.handleMessage(e.data);
		};
		dc.onerror = function(e) {
			// This should be followed by onClose, so don't need to do much here
			console.warn('Data channel error:', e);
		};
	};

	DCWrapper.prototype.close = function() {
		if (this.dataChannel) {
			this.dataChannel.close();
			this.dataChannel = null;
		}
	};

	DCWrapper.prototype.send = function(message) {
		var self = this;
		var dc = this.dataChannel;

		if (!dc || dc.readyState !== 'open') {
			console.log("Send failed: data channel not open:", this.dc.readyState);
			return false;
		}
		
		if (message instanceof CrocMSRP.Message.Request && message.method !== 'REPORT') {
			message.timer = setTimeout(function(){
				self.timeout(message);
			}, 30000);
			this.transactions[message.tid] = message;
		}
		
		try {
			dc.send(message.encode());
		} catch (e) {
			console.log("Send failed: " + e);
			return false;
		}
		
		return true;
	};

	DCWrapper.prototype.handleMessage = function(data) {
		// Parse MSRP message
		var msg = CrocMSRP.parseMessage(data);
		if (!msg) {
			// Oh dear
			console.log('MSRP message parsing error; closing data channel');
			this.dataChannel.close();
			return;
		}
		
		if (msg instanceof CrocMSRP.Message.Response) {
			// Check for outstanding transaction
			var request = this.transactions[msg.tid];
			if (request) {
				msg.request = request;
				clearTimeout(request.timer);
				delete request.timer;
				delete this.transactions[msg.tid];
				this.session.handleResponse(msg);
			} else {
				console.log("Unexpected response received; not in transaction list");
			}
			return;
		}
		
		this.session.handleRequest(msg);
	};

	DCWrapper.prototype.timeout = function(request) {
		delete request.timer;
		delete this.transactions[request.tid];
		var resp = new CrocMSRP.Message.IncomingResponse(request.tid, 408, CrocMSRP.StatusComment[408]);
		resp.request = request;
		this.session.handleResponse(resp);
	};

	CrocMSRP.DCWrapper = DCWrapper;

	return CrocMSRP;
}(CrocMSRP || {}));

