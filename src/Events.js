/*
 * Crocodile MSRP - https://github.com/crocodilertc/crocodile-msrp
 * Copyright (c) 2012-2013 Crocodile RCS Ltd
 * http://www.crocodilertc.net
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {

	/**
	 * Creates an events callback object used with a {@link CrocMSRP.Session}.
	 * The methods defined here should be overrided as appropriate to your
	 * application.
	 * 
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
	 * 
	 * @param {String} id The Message ID of the received message.
	 * @param {String} contentType The MIME type of the received message.
	 * @param {String|ArrayBuffer|Blob} body The body of the received message.
	 * Text data will be presented as a String. Binary data may be presented
	 * as an ArrayBuffer or a Blob, depending on whether the data fit into a
	 * single chunk. Blob data can be accessed using a FileReader object
	 * (http://www.w3.org/TR/FileAPI/), or used within the page DOM by turning
	 * it into a URL: <code>var url = URL.createObjectURL(blob);</code>.
	 * @throws {CrocMSRP.Exceptions.UnsupportedMedia} If the received MIME type
	 * is not recognised/supported by the application. An appropriate error will
	 * be returned to the relay in this case.
	 */
	CrocMSRP.Events.prototype.onMessageReceived = function() {
	};
	
	/**
	 * Event callback indicating that a sent message has been acknowledged by
	 * the MSRP relay.
	 * 
	 * @param {String} id The Message ID of the sent message (as returned
	 * by the {@link CrocMSRP.Session#send} function).
	 */
	CrocMSRP.Events.prototype.onMessageSent = function() {
	};
	
	/**
	 * Event callback indicating that a sent message has been delivered
	 * successfully (i.e. a REPORT message has been received from the far end).
	 * 
	 * @param {String} id The Message ID of the delivered message (as
	 * returned by the {@link CrocMSRP.Session#send} function).
	 */
	CrocMSRP.Events.prototype.onMessageDelivered = function() {
	};

	/**
	 * Event callback indicating that an outgoing message failed. Possible
	 * reasons include an error response from the relay, an abort from the
	 * receiving party, or a timeout waiting for a REPORT from the receiving
	 * party.
	 * 
	 * @param {String} id The Message ID of the failed message (as returned
	 * by the {@link CrocMSRP.Session#send} function).
	 * @param {String} status The error status returned. If we timed out locally,
	 * this will be set to 408.
	 * @param {String} comment The error comment returned (if present). If we
	 * timed out locally, this will be set to "Report Timeout".
	 */
	CrocMSRP.Events.prototype.onMessageSendFailed = function() {
	};
	
	/**
	 * Event callback indicating that the first chunk of a message has been
	 * received.  If this message only consists of a single chunk, the
	 * {@link #onChunkReceived} and {@link #onMessageReceived} events will be
	 * fired immediately after this one.
	 * To abort an unfinished transfer, call {@link CrocMSRP.Session#abortFileReceive}.
	 * 
	 * @param {String} id The Message ID of the received chunk.
	 * @param {String} contentType The MIME type of the incoming message.
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
	CrocMSRP.Events.prototype.onFirstChunkReceived = function() {
	};
	
	/**
	 * Event callback indicating that an incoming message chunk has been
	 * received. This is intended to allow the transfer progress to be monitored.
	 * 
	 * @param {String} id The Message ID of the received chunk.
	 * @param {Number} receivedBytes The total bytes received so far. Note that
	 * this may become greater than the reported file size if any chunks have
	 * been resent during the transfer.
	 */
	CrocMSRP.Events.prototype.onChunkReceived = function() {
	};
	
	/**
	 * Event callback indicating that an incoming message has been aborted.
	 * The abort may have been requested by the local or remote party.
	 * 
	 * @param {String} id The Message ID of the aborted message.
	 * @param {Blob} partialBody The partially-received message body.
	 */
	CrocMSRP.Events.prototype.onMessageReceiveAborted = function() {
	};
	
	/**
	 * Event callback indicating that an incoming message has timed out.
	 * 
	 * @param {String} id The Message ID of the timed-out message.
	 * @param {Blob} partialBody The partially-received message body.
	 */
	CrocMSRP.Events.prototype.onMessageReceiveTimeout = function() {
	};
	
	/**
	 * Event callback indicating that an outgoing message chunk has been
	 * sent. This is intended to allow the transfer progress to be monitored.
	 * 
	 * @param {String} id The Message ID of the sent chunk (as returned
	 * by the {@link CrocMSRP.Session#send} function).
	 * @param {Number} sentBytes The total bytes sent so far.
	 */
	CrocMSRP.Events.prototype.onChunkSent = function() {
	};
	
	CrocMSRP.mandatoryEvents = [
		'onAuthenticated',
		'onAuthFailed',
		'onError',
		'onMessageReceived',
		'onMessageSendFailed',
		'onFirstChunkReceived',
		'onMessageReceiveAborted',
		'onMessageReceiveTimeout',
		'onMessageDelivered'
	];

	return CrocMSRP;
}(CrocMSRP || {}));

