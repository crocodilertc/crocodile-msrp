/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {

	/**
	 * Creates an events callback object used with a {@link CrocMSRP.Session}.
	 * The methods defined here should be overrided as appropriate to your
	 * application.
	 * @class The Session event callback object.
	 */
	CrocMSRP.Events = function() {
	};
	
	/**
	 * Event callback indicating that the session has authenticated with the
	 * MSRP websocket relay, and is ready for SDP exchange.
	 */
	CrocMSRP.Events.prototype.onAuthenticated = function() {
	};
	
	/**
	 * Event callback indicating that the provided username/password has been
	 * rejected by the MSRP websocket relay.  The session has been abandoned and
	 * will not retry.
	 */
	CrocMSRP.Events.prototype.onAuthFailed = function() {
	};
	
	/**
	 * Event callback indicating that an unexpected error has occurred, and
	 * that the session has been abandoned as a result.
	 */
	CrocMSRP.Events.prototype.onError = function() {
	};
	
	/**
	 * Event callback indicating that a message has been received for the
	 * session.
	 * @param {String} contentType The MIME type of the received message.
	 * @param {String|Blob} body The body of the received message.
	 * @throws {CrocMSRP.Exceptions.UnsupportedMedia} If the received MIME type
	 * is not recognised/supported by the application. An appropriate error will
	 * be returned to the relay in this case.
	 */
	CrocMSRP.Events.prototype.onMessageReceived = function(contentType, body) {
	};
	
	/**
	 * Event callback indicating that a sent message has been acknowledged by
	 * the MSRP relay.
	 * @param {String} msgId The Message ID of the sent message (as returned
	 * by the {@link CrocMSRP.Session#send} function).
	 */
	CrocMSRP.Events.prototype.onMessageSent = function(msgId) {
	};
	
	/**
	 * Event callback indicating that a sent message has been delivered
	 * successfully (i.e. a REPORT message has been received from the far end).
	 * @param {String} msgId The Message ID of the delivered message (as
	 * returned by the {@link CrocMSRP.Session#send} function).
	 */
	CrocMSRP.Events.prototype.onMessageDelivered = function(msgId) {
	};

	/**
	 * Event callback indicating that an error response was received from the
	 * MSRP websocket relay when sending a message.
	 * @param {String} msgId The Message ID of the failed message (as returned
	 * by the {@link CrocMSRP.Session#send} function).
	 * @param {String} status The error status returned by the relay.
	 * @param {String} comment The error comment returned by the relay.
	 */
	CrocMSRP.Events.prototype.onMessageFailed = function(msgId, status, comment) {
	};
	
	/**
	 * Event callback indicating that an incoming file transfer has started for
	 * the session.
	 * To abort an unfinished transfer, call {@link CrocMSRP.Session#abortFileReceive}.
	 * @param {String} id A unique identifier for the incoming file transfer.
	 * @param {String} contentType The MIME type of the incoming file.
	 * @param {String} filename The file name, if provided by the far end;
	 * otherwise null.
	 * @param {Number} size The file size in bytes, if provided by the far end;
	 * otherwise -1.
	 * @param {String} description The file description, if provided by the far
	 * end; otherwise null.
	 * @throws {CrocMSRP.Exceptions.UnsupportedMedia} If the received MIME type
	 * is not recognised/supported by the application. An appropriate error will
	 * be returned to the relay in this case.
	 */
	CrocMSRP.Events.prototype.onFileReceiveStarted = function(id, contentType, filename, size, description) {
	};
	
	/**
	 * Event callback indicating that an incoming file transfer chunk has been
	 * received. This is intended to allow the transfer progress to be monitored.
	 * @param {String} id A unique identifier for the incoming file transfer.
	 * @param {Number} receivedBytes The total bytes received so far. Note that
	 * this may become greater than the reported file size if any chunks have
	 * been resent during the transfer.
	 */
	CrocMSRP.Events.prototype.onFileReceiveChunk = function(id, receivedBytes) {
	};
	
	/**
	 * Event callback indicating that an incoming file transfer has completed,
	 * and providing the transfered file to the application.
	 * @param {String} id A unique identifier for the incoming file transfer.
	 * @param {String} contentType The MIME type of the file.
	 * @param {Blob} file The received file. The file data may be read from the
	 * Blob using a FileReader object (http://www.w3.org/TR/FileAPI/).
	 * @throws {CrocMSRP.Exceptions.UnsupportedMedia} If the received MIME type
	 * is not recognised/supported by the application. An appropriate error will
	 * be returned to the relay in this case.
	 */
	CrocMSRP.Events.prototype.onFileReceiveCompleted = function(id, contentType, file) {
	};
	
	/**
	 * Event callback indicating that an incoming file transfer has been aborted
	 * by the remote party.
	 * @param {String} id A unique identifier for the incoming file transfer.
	 */
	CrocMSRP.Events.prototype.onFileReceiveAborted = function(id) {
	};
	
	/**
	 * Event callback indicating that an incoming file transfer has timed out.
	 * @param {String} id A unique identifier for the incoming file transfer.
	 */
	CrocMSRP.Events.prototype.onFileReceiveTimeout = function(id) {
	};
	
	/**
	 * Event callback indicating that an outgoing file transfer chunk has been
	 * sent. This is intended to allow the transfer progress to be monitored.
	 * @param {String} id A unique identifier for the outgoing file transfer.
	 * @param {Number} sentBytes The total bytes sent so far.
	 */
	CrocMSRP.Events.prototype.onFileSendChunk = function(id, sentBytes) {
	};
	
	/**
	 * Event callback indicating that an outgoing file transfer has completed,
	 * and providing the transfered file to the application.
	 * @param {String} id A unique identifier for the outgoing file transfer.
	 */
	CrocMSRP.Events.prototype.onFileSendCompleted = function(id) {
	};
	
	/**
	 * Event callback indicating that an outgoing file transfer failed. Possible
	 * reasons include an error response from the relay, an abort from the
	 * receiving party, or a timeout waiting for a REPORT from the receiving
	 * party.
	 * @param {String} id A unique identifier for the incoming file transfer.
	 * @param {String} status The error status returned. If we timed out locally,
	 * this will be set to 408.
	 * @param {String} comment The error comment returned (if present). If we
	 * timed out locally, this will be set to "Report Timeout".
	 */
	CrocMSRP.Events.prototype.onFileSendFailed = function(id, status, comment) {
	};
	
	CrocMSRP.mandatoryEvents = [
		'onAuthenticated',
		'onAuthFailed',
		'onError',
		'onMessageReceived',
		'onMessageFailed',
		'onFileReceiveStarted',
		'onFileReceiveCompleted',
		'onFileReceiveAborted',
		'onFileSendCompleted',
		'onFileSendFailed'
	];

	return CrocMSRP;
}(CrocMSRP || {}));

