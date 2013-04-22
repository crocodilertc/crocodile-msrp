/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var lineEnd = '\r\n';
	
	/**
	 * Parses a raw websocket message and returns a Message object.
	 * @param {String|ArrayBuffer} data Event data from the onmessage websocket event.
	 * @returns {CrocMSRP.Message.Message} Message object, or null if there an
	 * error is encountered.
	 * @private
	 */
	CrocMSRP.parseMessage = function(data) {
		var msg, startIndex = 0, endIndex, firstLine, tokens, statusCode, msgObj,
			parseResult, endLineNoFlag;
		
		if (data instanceof ArrayBuffer) {
			// Turn the ArrayBuffer into a string, assuming one-byte chars
			// The body will get sliced out once we locate it
			msg = String.fromCharCode.apply(null, new Uint8Array(data)); 
		} else if (data instanceof String || typeof data === 'string') {
			msg = data;
		} else {
			console.log('Unexpected parameter type');
			return null;
		}
		
		// Extract and parse the first line
		endIndex = msg.indexOf(lineEnd);
		if (endIndex === -1) {
			console.log('Error parsing message: no CRLF');
			return null;
		}
		
		firstLine = msg.substring(startIndex, endIndex);
		tokens = firstLine.split(' ');
		if (tokens.length < 3 || tokens[0] !== 'MSRP' ||
				tokens[1].length === 0 || tokens[2].length === 0) {
			console.log('Error parsing message: unexpected first line format: ' + firstLine);
			return null;
		}
		
		// Determine whether it is a request or response and construct the
		// appropriate object
		if (tokens[2].length === 3 && (statusCode = parseInt(tokens[2], 10))) {
			if (tokens.length > 3) {
				var comment = tokens.slice(3).join(' ');
				msgObj = new CrocMSRP.Message.IncomingResponse(tokens[1], statusCode, comment);
			} else {
				msgObj = new CrocMSRP.Message.IncomingResponse(tokens[1], statusCode);
			}
		} else if (tokens.length === 3) {
			msgObj = new CrocMSRP.Message.IncomingRequest(tokens[1], tokens[2]);
		} else {
			console.log('Error parsing message: unexpected first line format: ' + firstLine);
			return null;
		}
		
		// Iterate through the headers, adding them to the object
		startIndex = endIndex + lineEnd.length;
		while (true) {
			parseResult = getNextHeader(msg, startIndex, msgObj);
			if (parseResult > 0) {
				startIndex = parseResult;
			} else if (parseResult === 0) {
				break;
			} else {
				return null;
			}
		}
		
		// Perform further processing on selected headers
		if (!parseKnownHeaders(msgObj)) {
			console.log("Error parsing message: parseKnownHeaders failed");
			return null;
		}
		
		// Extract the message body (if present)
		endLineNoFlag = msgObj.getEndLineNoFlag();
		if (msg.substr(startIndex, lineEnd.length) === lineEnd) {
			// Empty line after headers indicates presence of a message body
			startIndex += lineEnd.length;
			endIndex = msg.indexOf(lineEnd + endLineNoFlag, startIndex);
			if (endIndex === -1) {
				console.log("Error parsing message: no end line after body");
				return null;
			}
			if (data instanceof ArrayBuffer) {
				// Slice out the body of the message from the original ArrayBuffer
				msgObj.body = data.slice(startIndex, endIndex);
			} else {
				// Assume we're only dealing with text
				msgObj.body = msg.substring(startIndex, endIndex);
			}

			msgObj.continuationFlag = msg.charAt(endIndex + lineEnd.length + endLineNoFlag.length);
		} else {
			msgObj.continuationFlag = msg.charAt(startIndex + endLineNoFlag.length);
		}
		
		return msgObj;
	};

	/**
	 * Remove any leading or trailing whitespace from the provided string.
	 * @param {String} str The string to process.
	 * @returns {String} The trimmed string.
	 * @private
	 */
	function chomp(str) {
		return str.replace(/^\s+/, '').replace(/\s+$/, '');
	}
	
	/**
	 * Remove double quotes from the start and end of the string, if present.
	 * @param {String} str The string to process.
	 * @returns {String} The unquoted string.
	 * @private
	 */
	function unq(str) {
		return str.replace(/^"/, '').replace(/"$/, '');
	}

	// Extracts the next header after startIndex, and adds it to the provided message object
	// Returns: Positive value: the new message position when a header is extracted
	//          0 if there are no more headers
	//          -1 if it encounters an error
	function getNextHeader(msg, startIndex, msgObj) {
		var endIndex, colonIndex, name, value,
			endLineNoFlag = msgObj.getEndLineNoFlag();
		
		// If there is a body, there will be an extra CRLF between the headers and
		// the body. If there is no body, we stop at the end-line.
		if (msg.substr(startIndex, 2) === '\r\n' ||
				msg.substr(startIndex, endLineNoFlag.length) === endLineNoFlag) {
			return 0;
		}
		
		endIndex = msg.indexOf('\r\n', startIndex);
		if (endIndex === -1) {
			// Oops - invalid message
			console.log('Error parsing header: no CRLF');
			return -1;
		}

		colonIndex = msg.indexOf(':', startIndex);
		if (colonIndex === -1) {
			// Oops - invalid message
			console.log('Error parsing header: no colon');
			return -1;
		}
		
		name = chomp(msg.substring(startIndex, colonIndex));
		if (name.length === 0) {
			console.log('Error parsing header: no name');
			return -1;
		}
		
		value = chomp(msg.substring(colonIndex + 1, endIndex));
		if (name.length === 0) {
			console.log('Error parsing header: no value');
			return -1;
		}
		
		msgObj.addHeader(name, value);
		
		return endIndex + 2;
	}

	function getNextAuthParam(str, startIndex, obj) {
		var equalsIndex, endIndex, name, value;
		
		// Find the next equals sign, which indicates the end of the parameter name
		equalsIndex = str.indexOf('=', startIndex);
		if (equalsIndex === -1) {
			return -1;
		}
		
		// Look for the end of this parameter, starting after the equals sign
		endIndex = equalsIndex + 1;
		if (str.charAt(endIndex) === '"') {
			// Quoted string - find the end quote
			// We assume that the string cannot itself contain double quotes,
			// as RFC 2617 makes no mention of escape sequences.
			endIndex = str.indexOf('"', endIndex + 1);
			if (endIndex === -1) {
				return -1;
			}
		}
		
		// The parameter value continues until the next unquoted comma, or the
		// end of the header line.
		endIndex = str.indexOf(',', endIndex);
		if (endIndex === -1) {
			endIndex = str.length;
		}
		
		// Trim any whitespace/quotes
		name = chomp(str.substring(startIndex, equalsIndex));
		value = unq(chomp(str.substring(equalsIndex + 1, endIndex)));
		
		// Check we've got something sensible
		if (name.length === 0 || value.length === 0) {
			return -1;
		}
		
		// Add the param to the result object, and return the current position
		// in the header line.
		obj[name] = value;
		return endIndex + 1;
	}
	
	function parseWwwAuthenticate(headerArray, msgObj) {
		var hdrIndex, value, authenticate, strIndex;
		
		// There could be multiple WWW-Authenticate headers, each giving
		// different algorithms or other options.
		for (hdrIndex in headerArray) {
			value = headerArray[hdrIndex];
			authenticate = {};
			
			if (!value.match(/^Digest /)) {
				return false;
			}
			
			strIndex = 7;
			while (strIndex !== -1 && strIndex < value.length) {
				strIndex = getNextAuthParam(value, strIndex, authenticate);
			}
			if (strIndex === -1) {
				return false;
			}
			
			msgObj.authenticate.push(authenticate);
		}
		return true;
	}
	
	function parseByteRange(headerArray, msgObj) {
		var value, range = {}, rangeSepIndex, totalSepIndex;
		
		// We only expect one Byte-Range header
		if (headerArray.length !== 1) {
			return false;
		}
		value = headerArray[0];
		
		rangeSepIndex = value.indexOf('-');
		totalSepIndex = value.indexOf('/', rangeSepIndex);
		if (rangeSepIndex === -1 || totalSepIndex === -1) {
			console.log('Unexpected Byte-Range format: ' + value);
			return false;
		}
		
		range.start = parseInt(chomp(value.substring(0, rangeSepIndex)), 10);
		range.end = chomp(value.substring(rangeSepIndex + 1, totalSepIndex));
		if (range.end === '*') {
			range.end = -1;
		} else {
			range.end = parseInt(range.end, 10);
		}
		range.total = chomp(value.substring(totalSepIndex + 1));
		if (range.total === '*') {
			range.total = -1;
		} else {
			range.total = parseInt(range.total, 10);
		}
		
		if (isNaN(range.start) || isNaN(range.end) || isNaN(range.total)) {
			console.log('Unexpected Byte-Range values: ' + value);
			return false;
		}
		
		msgObj.byteRange = range;
		return true;
	}
	
	function parseFailureReport(headerArray, msgObj) {
		// We only expect one Failure-Report header
		if (headerArray.length !== 1) {
			console.log('Multiple Failure-Report headers');
			return false;
		}
		
		switch (headerArray[0].toLowerCase()) {
		case 'yes':
			msgObj.responseOn = {success: true, failure: true};
			break;
		case 'no':
			msgObj.responseOn = {success: false, failure: false};
			break;
		case 'partial':
			msgObj.responseOn = {success: false, failure: true};
			break;
		default:
			console.log('Unexpected Failure-Report header: ' + headerArray[0]);
			return false;
		}
		
		return true;
	}
	
	function parseStatus(headerArray, msgObj) {
		var splitValue;
		
		// We only expect Status headers on REPORT requests.  Ignore the header
		// if we find it on a response.
		if (msgObj instanceof CrocMSRP.Message.Response) {
			console.log('Ignoring Status header on response');
			return true;
		}
		
		// We only expect one Status header
		if (headerArray.length !== 1) {
			console.log('Multiple Status headers');
			return false;
		}
		
		splitValue = headerArray[0].split(' ');
		if (splitValue.length < 2 || splitValue.shift() !== '000') {
			console.log('Unexpected Status header: ' + headerArray[0]);
			return false;
		}
		
		msgObj.status = parseInt(splitValue.shift(), 10);
		msgObj.comment = splitValue.join(' ');
		
		return true;
	}
	
	function parseUsePath(headerArray, msgObj) {
		// We only expect one Use-Path header
		if (headerArray.length !== 1) {
			console.log('Multiple Use-Path headers');
			return false;
		}
		
		msgObj.usePath = headerArray[0].split(' ');
		if (msgObj.usePath.length < 1) {
			console.log('Unexpected Use-Path header: ' + headerArray[0]);
			return false;
		}
		
		return true;
	}
	
	function parseExpires(headerArray, msgObj) {
		// We only expect one Expires header
		if (headerArray.length !== 1) {
			console.log('Multiple Expires headers');
			return false;
		}
		
		msgObj.expires = parseInt(headerArray[0], 10);
		if (isNaN(msgObj.expires)) {
			console.log('Unexpected Expires header: ' + headerArray[0]);
			return false;
		}
		
		return true;
	}
	
	function parseContentDisposition(headerArray, msgObj) {
		var splitValue, index, splitParam;
		
		// We only expect MIME headers on SEND requests.  Ignore the header
		// if we find it on a response.
		if (msgObj instanceof CrocMSRP.Message.Response) {
			console.log('Ignoring Content-Disposition header on response');
			return true;
		}
		
		// We only expect one Content-Disposition header
		if (headerArray.length !== 1) {
			console.log('Multiple Content-Disposition headers');
			return false;
		}
		
		splitValue = headerArray[0].split(';');
		if (splitValue.length < 1) {
			console.log('Unexpected Content-Disposition header: ' + headerArray[0]);
			return false;
		}
		
		msgObj.contentDisposition = {};
		msgObj.contentDisposition.type = chomp(splitValue.shift());
		msgObj.contentDisposition.param = {};
		for (index in splitValue) {
			splitParam = splitValue[index].split('=');
			if (splitParam.length !== 2) {
				console.log('Unexpected Content-Disposition param: ' + splitValue[index]);
				return false;
			}
			
			msgObj.contentDisposition.param[chomp(splitParam[0])] = unq(chomp(splitParam[1]));
		}
		
		return true;
	}
	
	function parseMsgId(headerArray, msgObj) {
		// We only expect one Message-ID header
		if (headerArray.length !== 1) {
			console.log('Multiple Message-ID headers');
			return false;
		}
		
		msgObj.messageId = chomp(headerArray[0]);
		if (msgObj.messageId.length < 1) {
			console.log('Unexpected Message-ID header: ' + headerArray[0]);
			return false;
		}
		
		return true;
	}
	
	var headerParsers = {
		'Message-ID': parseMsgId,
		'Failure-Report': parseFailureReport,
		'Byte-Range': parseByteRange,
		'Status': parseStatus,
		'Content-Disposition': parseContentDisposition,
		'WWW-Authenticate': parseWwwAuthenticate,
		'Use-Path': parseUsePath,
		'Expires': parseExpires,
		'Min-Expires': parseExpires,
		'Max-Expires': parseExpires
	};
	
	function parseKnownHeaders(msgObj) {
		var header, parseFn;
		for (header in msgObj.headers) {
			parseFn = headerParsers[header];
			if (!parseFn) {
				// Ignore unknown headers
				continue;
			}
			
			if (!parseFn(msgObj.headers[header], msgObj)) {
				console.log('Parsing failed for header ' + header);
				return false;
			}
		}
		
		return true;
	}
	
	return CrocMSRP;
}(CrocMSRP || {}));

