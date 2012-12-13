/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {

	/**
	 * Creates a new FileParams object.
	 * @class A FileParams object contains various properties of a file that can
	 * be included in SDP (see RFC 5547). It can be passed to
	 * {@link CrocMSRP.Connection#createFileTransferSession} when creating a
	 * Session to define various properties of the file to be sent. If one is not
	 * provided, some of the details may be determined through other means.
	 * For incoming files, this object is available as
	 * {@link CrocMSRP.Session#fileParams} after having processed the incoming
	 * SDP offer.
	 */
	CrocMSRP.FileParams = function() {
		/**
		 * The file selector, as defined in RFC 5547.  At least one of the
		 * selector properties MUST be defined; in RCS-e it is recommended
		 * that both size and type are included.
		 * @type Object
		 */
		this.selector = {};
		/**
		 * The file name.  Should not include any file path elements, or
		 * characters that may be "meaningful to the local operating system".
		 * @type String
		 * @fieldOf CrocMSRP.FileParams#
		 */
		this.selector.name = '';
		/**
		 * The file size in octets.
		 * @type Number
		 * @fieldOf CrocMSRP.FileParams#
		 */
		this.selector.size = 0;
		/**
		 * The MIME type of the file.  If parameters are present, the object
		 * form is preferred; they may need to be encoded differently depending
		 * on the context.
		 * @type String|CrocMSRP.ContentType
		 * @fieldOf CrocMSRP.FileParams#
		 */
		this.selector.type = '';
		/**
		 * Zero or more hashes of the file contents.  Hashes are added to
		 * this object as properties with the hash algorithm as the property
		 * name (currently only sha1 is supported under RFC 5547), and the
		 * calculated hash as the value (pairs of upper case hex, separated
		 * by colons).
		 * @type Object
		 * @fieldOf CrocMSRP.FileParams#
		 */
		this.selector.hash = {};
		/**
		 * The file-transfer-id, which should uniquely identify the file transfer.
		 * @type String
		 */
		this.id = '';
		/**
		 * The optional file-disposition. Expected values are 'render' (the
		 * default), or 'attachment', though any IANA-registered disposition is
		 * allowed.
		 * @type String
		 */
		this.disposition = '';
		/**
		 * The optional description of the file.
		 * @type String
		 */
		this.description = '';
		/**
		 * The optional cid-url referencing a Content-ID containing a preview of
		 * the file (normally used for image thumbnails).
		 * @type String
		 */
		this.icon = '';
	};
	
	return CrocMSRP;
}(CrocMSRP || {}));

