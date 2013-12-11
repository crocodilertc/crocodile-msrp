/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var lineEnd = '\r\n';
	
	/**
	 * @namespace Encapsulates all of the MSRP message classes.
	 * @private
	 */
	CrocMSRP.Message = {};
	
	CrocMSRP.Message.Flag = {
		continued: '+',
		end: '$',
		abort: '#'
	};
	
	/**
	 * Creates a new Message object.
	 * @class Parent class for all MSRP messages.
	 * @private
	 */
	CrocMSRP.Message.Message = function() {};
	CrocMSRP.Message.Message.prototype.initMessage = function() {
		this.tid = null;
		this.toPath = [];
		this.fromPath = [];
		this.headers = {};
		this.continuationFlag = CrocMSRP.Message.Flag.end;
	};
	CrocMSRP.Message.Message.prototype.addHeader = function(name, value) {
		name = CrocMSRP.util.normaliseHeader(name);

		// Standard headers are stored in their own properties
		switch (name) {
		case 'To-Path':
			this.toPath = value.split(' ');
			return;
		case 'From-Path':
			this.fromPath = value.split(' ');
			return;
		case 'Content-Type':
			this.contentType = value;
			return;
		default:
			break;
		}
		
		if (this.headers[name]) {
			this.headers[name].push(value);
		} else {
			this.headers[name] = [value];
		}
	};
	CrocMSRP.Message.Message.prototype.getHeader = function(name) {
		name = CrocMSRP.util.normaliseHeader(name);
		if (name in this.headers) {
			if (this.headers[name].length > 1) {
				return this.headers[name];
			}
			return this.headers[name][0];
		}
		return null;
	};
	CrocMSRP.Message.Message.prototype.getEndLineNoFlag = function() {
		return '-------' + this.tid;
	};
	CrocMSRP.Message.Message.prototype.getEndLine = function() {
		return this.getEndLineNoFlag().concat(this.continuationFlag, lineEnd);
	};

	/**
	 * Creates a new Request object.
	 * @class Parent class for all MSRP requests.
	 * @extends CrocMSRP.Message.Message
	 * @private
	 */
	CrocMSRP.Message.Request = function() {};
	CrocMSRP.Message.Request.prototype = new CrocMSRP.Message.Message();
	CrocMSRP.Message.Request.prototype.constructor = CrocMSRP.Message.Request;
	CrocMSRP.Message.Request.prototype.initRequest = function() {
		this.initMessage();
		this.method = null;
		this.contentType = null;
		this.body = null;
	};
	CrocMSRP.Message.Request.prototype.addBody = function(type, body) {
		this.contentType = type;
		this.body = body;
	};
	CrocMSRP.Message.Request.prototype.addTextBody = function(text) {
		this.addBody('text/plain', text);
	};

	/**
	 * Creates a new Response object.
	 * @class Parent class for all MSRP responses.
	 * @extends CrocMSRP.Message.Message
	 * @private
	 */
	CrocMSRP.Message.Response = function() {};
	CrocMSRP.Message.Response.prototype = new CrocMSRP.Message.Message();
	CrocMSRP.Message.Response.prototype.constructor = CrocMSRP.Message.Response;
	CrocMSRP.Message.Response.prototype.initResponse = function() {
		this.initMessage();
		this.status = null;
		this.comment = null;
	};

	/**
	 * Creates a new outgoing MSRP request.
	 * @class Class representing an outgoing MSRP request.
	 * @extends CrocMSRP.Message.Request
	 * @private
	 */
	CrocMSRP.Message.OutgoingRequest = function(session, method) {
		if(!session || !method) {
			throw new TypeError('Required parameter is missing');
		}

		this.initRequest();
		this.tid = CrocMSRP.util.newTID();
		this.method = method;

		this.toPath = session.toPath;
		this.fromPath = [session.localUri];
		this.session = session;
		
		this.byteRange = null;
	};
	CrocMSRP.Message.OutgoingRequest.prototype = new CrocMSRP.Message.Request();
	CrocMSRP.Message.OutgoingRequest.prototype.constructor = CrocMSRP.Message.OutgoingRequest;
	CrocMSRP.Message.OutgoingRequest.prototype.encode = function() {
		var msg = '', name, type = this.contentType,
			end = this.getEndLine();
		
		if (this.body && (this.body instanceof String || typeof this.body === 'string')) {
			// If the body contains the end-line, change the transaction ID
			while (this.body.indexOf(end) !== -1) {
				this.tid = CrocMSRP.util.newTID();
				end = this.getEndLine();
			}
		}
		
		msg = msg.concat('MSRP ', this.tid, ' ', this.method, lineEnd);
		msg = msg.concat('To-Path: ', this.toPath.join(' '), lineEnd);
		msg = msg.concat('From-Path: ', this.fromPath.join(' '), lineEnd);
		
		if (this.byteRange) {
			var r = this.byteRange,
				total = (r.total < 0 ? '*' : r.total);
			this.addHeader('byte-range', r.start + '-' + r.end + '/' + total);
		}
		
		for (name in this.headers) {
			msg = msg.concat(name, ': ', this.headers[name].join(' '), lineEnd);
		}
		
		if (type && this.body) {
			// Content-Type is the last header, and a blank line separates the
			// headers from the message body.
			if (type instanceof CrocMSRP.ContentType) {
				type = type.toContentTypeHeader();
			}
			msg = msg.concat('Content-Type: ', type, lineEnd, lineEnd);
			
			if (this.body instanceof String || typeof this.body === 'string') {
				msg = msg.concat(this.body, lineEnd, end);
			} else {
				// Turn the entire message into a blob, encapsulating the body
				msg = new Blob([msg, this.body, lineEnd, end]);
			}
		} else {
			msg += end;
		}
				
		return msg;
	};

	/**
	 * Creates a new incoming MSRP request.
	 * @class Class representing an incoming MSRP request.
	 * @extends CrocMSRP.Message.Request
	 * @private
	 */
	CrocMSRP.Message.IncomingRequest = function(tid, method) {
		if(!tid || !method) {
			return null;
		}

		this.initRequest();
		this.tid = tid;
		this.method = method;

		switch (method) {
		case 'SEND':
			// Start by assuming responses are required
			// Can be overriden by request headers
			this.responseOn = {success: true, failure: true};
			break;
		case 'REPORT':
			// Never send responses
			this.responseOn = {success: false, failure: false};
			break;
		}
		
		this.byteRange = {start: 1, end: -1, total: -1};
	};
	CrocMSRP.Message.IncomingRequest.prototype = new CrocMSRP.Message.Request();
	CrocMSRP.Message.IncomingRequest.prototype.constructor = CrocMSRP.Message.IncomingRequest;

	/**
	 * Creates a new outgoing MSRP response.
	 * @class Class representing an outgoing MSRP response.
	 * @extends CrocMSRP.Message.Response
	 * @private
	 */
	CrocMSRP.Message.OutgoingResponse = function(request, localUri, status) {
		if(!request || !localUri) {
			return null;
		}

		this.initResponse();
		this.tid = request.tid;
		this.status = status || CrocMSRP.Status.OK;
		this.comment = CrocMSRP.StatusComment[this.status];
		
		if (request.method === 'SEND') {
			// Response is only sent to the previous hop
			this.toPath = request.fromPath.slice(0, 1);
		} else {
			this.toPath = request.fromPath;
		}
		this.fromPath = [localUri.toString()];
	};
	CrocMSRP.Message.OutgoingResponse.prototype = new CrocMSRP.Message.Response();
	CrocMSRP.Message.OutgoingResponse.prototype.constructor = CrocMSRP.Message.OutgoingResponse;
	CrocMSRP.Message.OutgoingResponse.prototype.encode = function() {
		var msg = '', name;
		
		msg = msg.concat('MSRP ', this.tid, ' ', this.status);
		if (this.comment) {
			msg = msg.concat(' ', this.comment);
		}
		msg += lineEnd;
		
		msg = msg.concat('To-Path: ', this.toPath.join(' '), lineEnd);
		msg = msg.concat('From-Path: ', this.fromPath.join(' '), lineEnd);
		
		for (name in this.headers) {
			msg = msg.concat(name, ': ', this.headers[name].join(' '), lineEnd);
		}
		
		return msg + this.getEndLine();
	};

	/**
	 * Creates a new incoming MSRP response.
	 * @class Class representing an incoming MSRP response.
	 * @extends CrocMSRP.Message.Response
	 * @private
	 */
	CrocMSRP.Message.IncomingResponse = function(tid, status, comment) {
		if(!tid || !status) {
			return null;
		}

		this.initResponse();
		this.tid = tid;
		this.status = status;
		this.comment = comment;
		this.request = null;
		this.authenticate = [];
	};
	CrocMSRP.Message.IncomingResponse.prototype = new CrocMSRP.Message.Response();
	CrocMSRP.Message.IncomingResponse.prototype.constructor = CrocMSRP.Message.IncomingResponse;

	return CrocMSRP;
}(CrocMSRP || {}));

