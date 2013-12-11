/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {

	/**
	 * Creates a new ConnectionConfig object, with sensible defaults.
	 * @class A ConnectionConfig object contains optional configuration settings
	 * that can be passed to the constructor {@link CrocMSRP.Connection}.
	 */
	CrocMSRP.ConnectionConfig = function() {
		/**
		 * The authority (hostname) used in local MSRP URIs. This will
		 * default to a randomly-generated hostname in the 'invalid'
		 * domain.
		 * @type String
		 */
		this.authority = CrocMSRP.util.newUriAuthority();
		/**
		 * The username to use for authentication (in the MSRP AUTH request).
		 * @type String
		 */
		this.username = 'anonymous';
		/**
		 * The password to use for authentication (in the MSRP AUTH request).
		 * @type String
		 */
		this.password = '';
		/**
		 * The method name to use for authentication. This defaults to the
		 * MSRP method being challenged (i.e. 'AUTH'), but is configurable
		 * in case the server implementation expects something else (such as
		 * 'MSRP').
		 * @type String
		 */
		this.digestMethod = null;
		/**
		 * The MSRP AUTH request can include a suggested expiry time for the
		 * authentication, after which the authentication (and its associated
		 * relay URI) become invalid.  However, the server is not obliged
		 * to use the suggested time; if it falls outside of the server's
		 * minimum or maximum allowed values, the AUTH will be automatically
		 * retried with the the closest allowed value.
		 * @type Number
		 */
		this.authExpires = null;
		/**
		 * The MSRP REPORT timeout, in seconds.
		 * MSRP REPORTs are enabled by default. Any sucessfully sent message
		 * that does not receive a REPORT within this number of seconds will
		 * be reported as a failure.
		 * @type Number
		 * @see CrocMSRP.Events#onMessageFailed
		 * @see CrocMSRP.Events#onFileSendFailed
		 */
		this.reportTimeout = 120000;
		/**
		 * The list of MIME types understood by the application.
		 * Including an '*' in this list indicates that any MIME type may
		 * be sent by the far end; any received messages with MIME types
		 * that are not understood should be rejected with an
		 * {@link CrocMSRP.Exceptions.UnsupportedMedia} exception.
		 * Note that the MSRP specification (RFC 4975) mandates the support
		 * of certain types, such as 'message/cpim'.
		 * @type String[]
		 * @see CrocMSRP.Events#onMessageReceived
		 */
		this.acceptTypes = ['*'];
		/**
		 * The list of MIME types understood by the application, when wrapped
		 * within a supported container type.  By only listing supported
		 * container types in acceptTypes, an endpoint can mandate that all
		 * messages use containers whilst still having control over the
		 * encapsulated types.
		 * @type String[]
		 */
		this.acceptWrappedTypes = null;
		/**
		 * The MSRP chunk size, in bytes.
		 * Messages larger than the configured chunk size will be split into
		 * chunks for sending.  The selected chunk size has an impact on
		 * bandwidth efficiency and performance; larger chunks are more
		 * efficient, but may increase latency for other messages. It is
		 * not advisable to increase this beyond 16KB.
		 * @type Number
		 */
		this.chunkSize = 2048;
		/**
		 * The maximum number of outstanding SEND requests allowed.
		 * Increasing this number may improve performance if the connection
		 * has available bandwidth, but high latency.  However, increasing
		 * it also risks overflowing the TCP send buffer, which will cause
		 * the connection to drop.
		 * @type Number
		 */
		this.maxOutstandingSends = (32 * 1024 / this.chunkSize);
		/**
		 * The timeout for receiving a new chunk of an incoming message, in
		 * seconds.
		 * If the next chunk of an incoming message is not received within
		 * this time, an error event is raised, and the incomplete data is
		 * discarded.
		 * @type Number
		 * @see CrocMSRP.Events#onFileReceiveTimeout
		 */
		this.chunkTimeout = 30 * 1000;
		/**
		 * The receive buffer for incoming message chunks, in bytes.
		 * When receiving a message, up to this many bytes will be cached
		 * in memory before being cached in a Blob.  A larger buffer reduces
		 * disk I/O, and generally increases performance, but requires more
		 * memory.
		 * @type Number
		 */
		this.recvBuffer = 1024 * 1024;
	};
	
	return CrocMSRP;
}(CrocMSRP || {}));

