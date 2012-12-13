/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var unixToNtpOffset = 2208988800;
	
	/**
	 * @namespace Shared utility functions
	 * @private
	 */
	CrocMSRP.util = {
		newUriAuthority: function() {
			// Create new URI Authority (used in local MSRP URI)
			// Use a random eight-character alphanumeric string.
			return Math.random().toString(36).substr(2,8) + '.invalid';
		},
		
		newSID: function() {
			// Create new Session ID (used in local MSRP URI)
			// RFC 4975 section 14.1 requires 80 bits of randomness
			// Use a random ten-character alphanumeric string.
			return Math.random().toString(36).substr(2,10);
		},
		
		newTID: function() {
			// Create new Transaction ID (used for delimiting individual chunks)
			// Use a random eight-character alphanumeric string.
			// Could be longer, but RFC4975 only requires 64-bits of randomness.
			return Math.random().toString(36).substr(2,8);
		},
		
		newMID: function() {
			// Create new Message ID (used to identify an individual message, which may be chunked)
			// RFC 4975 suggests a complicated way of ensuring uniqueness, but we're
			// being lazy.
			var now = new Date();
			return CrocMSRP.util.dateToNtpTime(now) + '.' + Math.random().toString(36).substr(2,8);
		},
		
		newFileTransferId: function() {
			// Create new File Transfer ID (see RFC 5547). This must uniquely
			// identify a file transfer within a session, and ideally should be
			// globally unique.
			var now = new Date();
			return CrocMSRP.util.dateToNtpTime(now) + '.' + Math.random().toString(36).substr(2);
		},
		
		normaliseHeader: function(name) {
			// Normalise the header capitalisation
			var parts = name.toLowerCase().split('-'),
				part,
				header = '';
				
			for (part in parts) {
				if (part !== '0') {
					header += '-';
				}
				header += parts[part].charAt(0).toUpperCase() + parts[part].substring(1);
			}
			
			switch(header) {
			case 'Www-Authenticate':
				return 'WWW-Authenticate';
			case 'Message-Id':
				return 'Message-ID';
			}
			
			return header;
		},
		
		isEmpty: function(map) {
			var property;
			for (property in map) {
				if (map.hasOwnProperty(property)) {
					return false;
				}
			}
			return true;
		},
		
		ntpTimeToDate: function(ntpTime) {
			return new Date((parseInt(ntpTime, 10) - unixToNtpOffset) * 1000);
		},
		
		dateToNtpTime: function(date) {
			return parseInt(date.getTime() / 1000, 10) + unixToNtpOffset;
		},
		
		/**
		 * Encodes a string as an SDP filename-string, as defined in RFC 5547.
		 * @param {String} str The string to encode.
		 * @returns {String} The encoded string.
		 */
		encodeSdpFileName: function(str) {
			return str.replace(/%/g, '%25')
				.replace(/\0/g, '%00')
				.replace(/\n/g, '%0A')
				.replace(/\r/g, '%0D')
				.replace(/"/g, '%22');
		},
	
		/**
		 * Decodes an SDP filename-string, as defined in RFC 5547.
		 * @param {String} str The string to decode.
		 * @returns {String} The decoded string.
		 */
		decodeSdpFileName: function(str) {
			return str.replace(/%00/g, '\0')
				.replace(/%0A/gi, '\n')
				.replace(/%0D/gi, '\r')
				.replace(/%22/g, '"')
				.replace(/%25/g, '%');
		},

		/**
		 * Encodes a string as a quoted-string, as defined in RFC 822.
		 * Note: does not support folding, as this is not used in MSRP.
		 * @param {String} str The string to encode.
		 * @returns {String} The encoded string.
		 */
		encodeQuotedString: function(str) {
			var chars = str.split(''), index;
			for (index in chars) {
				switch (chars[index]) {
				case '"':
				case '\r':
				case '\\':
					// These must be escaped as a quoted-pair
					chars[index] = '\\' + chars[index];
					break;
				}
			}
			return chars.join('');
		},
	
		/**
		 * Decodes a quoted-string, as defined in RFC 822.
		 * Note: does not support folding, as this is not used in MSRP.
		 * @param {String} str The string to decode.
		 * @returns {String} The decoded string.
		 */
		decodeQuotedString: function(str) {
			var chars = str.split(''), index, escaped = false;
			for (index in chars) {
				if (escaped) {
					// Always include this char as-is
					continue;
				}
				
				if (chars[index] === '\\') {
					escaped = true;
					delete chars[index];
				}
			}
			return chars.join('');
		}
	
	};
	
	return CrocMSRP;
}(CrocMSRP || {}));

