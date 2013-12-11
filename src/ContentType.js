/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {

	/**
	 * Creates a new ContentType object.
	 * @class Generic representation of a MIME type, along with optional
	 * parameters. Provides methods to convert to and from different
	 * representations.
	 */
	CrocMSRP.ContentType = function() {
		/**
		 * The MIME type.
		 * @type String
		 */
		this.type = '';
		/**
		 * The MIME sub type.
		 * @type String
		 */
		this.subtype = '';
		/**
		 * Zero or more content type parameters.
		 * @type Object
		 */
		this.params = {};
	};
	
	/**
	 * Parses an SDP type selector, as defined in RFC 5547.
	 * @param {String} selector The selector value to parse.
	 */
	CrocMSRP.ContentType.prototype.parseSdpTypeSelector = function(selector) {
		var position = 0, endIndex, param, value;
		
		// Type
		endIndex = selector.indexOf('/', position);
		if (endIndex === -1) {
			// Unexpected input
			return;
		}
		this.type = selector.slice(position, endIndex);
		position = endIndex + 1;
		
		// Subtype
		endIndex = position;
		while (endIndex < selector.length) {
			if (selector.charAt(endIndex) === ';') {
				break;
			}
			endIndex++;
		}
		this.subtype = selector.slice(position, endIndex);
		position = endIndex + 1;
		
		// Parameters
		this.params = {};
		while (selector.charAt(endIndex) === ';') {
			// Parse content type parameter
			endIndex = selector.indexOf('=', position);
			if (endIndex === -1) {
				// Unexpected input
				position = selector.length;
				return;
			}
			param = selector.slice(position, endIndex);
			position = endIndex + 1;
			
			if (selector.charAt(position) !== '"') {
				// Unexpected input
				position = selector.length;
				return;
			}
			position++;
			endIndex = selector.indexOf('"', position);
			if (endIndex === -1) {
				// Unexpected input
				position = selector.length;
				return;
			}
			value = selector.slice(position, endIndex);
			position = endIndex + 1;
			
			this.params[param] = CrocMSRP.util.decodeSdpFileName(value);
		}
	};
	
	/**
	 * Encodes the content type as an SDP type selector, as defined in RFC 5547.
	 * @returns {String} The encoded selector value.
	 */
	CrocMSRP.ContentType.prototype.toSdpTypeSelector = function() {
		var selector = '', param;
		
		selector = selector.concat(this.type, '/', this.subtype);
		for (param in this.params) {
			selector = selector.concat(';', param, '="',
				CrocMSRP.util.encodeSdpFileName(this.params[param]), '"');
		}
		
		return selector;
	};
	
	/**
	 * Parses a Content-Type header, as defined in RFC 2045.
	 * Note: Does not allow for unquoted white space.
	 * @param {String} header The header value to parse.
	 */
	CrocMSRP.ContentType.prototype.parseContentTypeHeader = function(header) {
		var position = 0, endIndex, param, value;
		
		// Type
		endIndex = header.indexOf('/', position);
		if (endIndex === -1) {
			// Unexpected input
			return;
		}
		this.type = header.slice(position, endIndex);
		position = endIndex + 1;
		
		// Subtype
		endIndex = position;
		while (endIndex < header.length) {
			if (header.charAt(endIndex) === ';') {
				break;
			}
			endIndex++;
		}
		this.subtype = header.slice(position, endIndex);
		position = endIndex + 1;
		
		// Parameters
		this.params = {};
		while (header.charAt(endIndex) === ';') {
			// Parse content type parameter
			endIndex = header.indexOf('=', position);
			if (endIndex === -1) {
				// Unexpected input
				position = header.length;
				return;
			}
			param = header.slice(position, endIndex);
			position = endIndex + 1;
			
			if (header.charAt(position) === '"') {
				position++;
				endIndex = header.indexOf('"', position);
				if (endIndex === -1) {
					// Unexpected input
					position = header.length;
					return;
				}
				while (header.charAt(endIndex - 1) === '\\') {
					endIndex = header.indexOf('"', endIndex + 1);
					if (endIndex === -1) {
						// Unexpected input
						position = header.length;
						return;
					}
				}
			} else {
				endIndex = header.indexOf(' ', position);
				if (endIndex === -1) {
					endIndex = header.length;
				}
			}
			value = header.slice(position, endIndex);
			position = endIndex + 1;
			
			this.params[param] = CrocMSRP.util.decodeQuotedString(value);
		}
	};
	
	/**
	 * Encodes the content type as an Content-Type header, as defined in RFC 2045.
	 * @returns {String} The encoded header value.
	 */
	CrocMSRP.ContentType.prototype.toContentTypeHeader = function() {
		var header = '', param;
		
		header = header.concat(this.type, '/', this.subtype);
		for (param in this.params) {
			header = header.concat(';', param, '="',
				CrocMSRP.util.encodeQuotedString(this.params[param]), '"');
		}
		
		return header;
	};
	
	return CrocMSRP;
}(CrocMSRP || {}));

