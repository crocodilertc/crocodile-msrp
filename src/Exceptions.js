/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {

	/**
	 * Encapsulates CrocMSRP exceptions.
	 * @namespace
	 */
	CrocMSRP.Exceptions = {};
	
	/**
	 * Creates an UnsupportedMedia exception.
	 * @class Exception thrown by the application's onMessageReceived callback
	 * if it cannot understand the MIME type of a received SEND request.
	 */
	CrocMSRP.Exceptions.UnsupportedMedia = function() {};
	CrocMSRP.Exceptions.UnsupportedMedia.prototype = new Error();
	CrocMSRP.Exceptions.UnsupportedMedia.prototype.constructor = CrocMSRP.Exceptions.UnsupportedMedia;

	/**
	 * Creates an AbortTransfer exception.
	 * @class Internal exception used to trigger a 413 response to file transfer
	 * chunks.
	 * @private
	 */
	CrocMSRP.Exceptions.AbortTransfer = function() {};
	CrocMSRP.Exceptions.AbortTransfer.prototype = new Error();
	CrocMSRP.Exceptions.AbortTransfer.prototype.constructor = CrocMSRP.Exceptions.AbortTransfer;

	return CrocMSRP;
}(CrocMSRP || {}));

