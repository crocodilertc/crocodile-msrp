/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	/** @constant */
	CrocMSRP.Status = {
		OK: 200,
		BAD_REQUEST: 400,
		UNAUTHORIZED: 401,
		FORBIDDEN: 403,
		REQUEST_TIMEOUT: 408,
		STOP_SENDING: 413,
		UNSUPPORTED_MEDIA: 415,
		INTERVAL_OUT_OF_BOUNDS: 423,
		SESSION_DOES_NOT_EXIST: 481,
		INTERNAL_SERVER_ERROR: 500, // Not actually defined in spec/registry!
		NOT_IMPLEMENTED: 501,
		WRONG_CONNECTION: 506
	};
	
	/** @constant */
	CrocMSRP.StatusComment = {
		200: 'OK',
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		408: 'Request Timeout',
		413: 'Stop Sending Message',
		415: 'Unsupported Media Type',
		423: 'Interval Out-of-Bounds',
		481: 'Session Does Not Exist',
		500: 'Internal Server Error', // Not actually defined in spec/registry!
		501: 'Not Implemented',
		506: 'Wrong Connection'
	};
	
	return CrocMSRP;
}(CrocMSRP || {}));

