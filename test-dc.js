var offer, answer, reader, lastFilename, sender, sBytes, receiver, rBytes, rBytesDelta, progressInterval, sFileMsgId, rFileMsgId;

function addEventHandlers(session, user) {
	session.onMessageReceived = function(id, contentType, body) {
		if (id !== rFileMsgId) {
			console.log(user + ' onMessageReceived (' + typeof body + ', ' + contentType + '):');
			if (body instanceof String || typeof body === 'string') {
				console.log(body);
			} else {
				reader = new FileReader();
				reader.onload = function() {console.log(reader.result);};
				reader.readAsText(body);
			}
		} else {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			
			if (body instanceof ArrayBuffer ||
					body instanceof String || typeof body === 'string') {
				body = new Blob([body], {type:contentType});
			}
			var url = URL.createObjectURL(body);
			var a = document.createElement('a');
			a.href = url;
			a.target = '_blank';
			a.download = lastFilename;
			a.appendChild(document.createTextNode('Download file'));
			el.appendChild(a);
			console.log(user + ' onMessageReceived: id=' + id + ', contentType=' + contentType + ', size=' + body.size);
			clearInterval(progressInterval);
			updateProgress();
		}
	};
	session.onMessageSent = function(id) {
		console.log(user + ' onMessageSent: id=' + id);
	};
	session.onMessageDelivered = function(id) {
		console.log(user + ' onMessageDelivered: id=' + id);
		if (id === sFileMsgId) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Send successful!'));
		}
	};
	session.onMessageSendFailed = function(id, status, comment) {
		console.log(user + ' onMessageSendFailed: id=' + id + ', status=' + status + ', comment=' + comment);
		if (id === sFileMsgId) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Send failed!'));
		}
	};
	session.onFirstChunkReceived = function(id, contentType, filename, size, description) {
		if (filename) {
			var el = document.getElementById(user + '-details');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Receiving File: id=' + id + ', contentType=' + contentType + ', filename=' + filename + ', size=' + size + ', description=' + description));
			lastFilename = filename;
			progressInterval = setInterval(updateProgress, 500);
			receiver = user;
			rBytes = rBytesDelta = 0;
			rFileMsgId = id;
		}
	};
	session.onChunkReceived = function(id, receivedBytes) {
		if (id === rFileMsgId) {
			rBytesDelta += receivedBytes - rBytes;
			rBytes = receivedBytes;
		}
	};
	session.onMessageReceiveAborted = function(id, partialBody) {
		if (id === rFileMsgId) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Receive aborted!'));
			clearInterval(progressInterval);
		}
	};
	session.onMessageReceiveTimeout = function(id) {
		if (id === rFileMsgId) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Receive timeout!'));
			clearInterval(progressInterval);
		}
	};
	session.onChunkSent = function(id, sentBytes) {
		if (id === sFileMsgId) {
			sBytes = sentBytes;
			sender = user;
		}
	};
};

// Stuff to enable drag and drop file transfer
function noopHandler(evt) {
	evt.stopPropagation();
	evt.preventDefault();
}

function dropHandler(user, session) {
	return function(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		
		sFileMsgId = session.send(evt.dataTransfer.files[0], null, 'Drag n Drop file');
	};
}

function addListeners(element, user, session) {
	element.addEventListener('dragenter', noopHandler, false);
	element.addEventListener('dragexit', noopHandler, false);
	element.addEventListener('dragover', noopHandler, false);
	element.addEventListener('drop', dropHandler(user, session), false);
}

function onload() {
	// Set up the drag and drop targets
	addListeners(document.getElementById('alice-dropbox'), 'alice', alice.session);
	addListeners(document.getElementById('bob-dropbox'), 'bob', bob.session);
}

function updateProgress() {
	var el = document.getElementById(sender + '-progress');
	while (el.hasChildNodes()) {
		el.removeChild(el.firstChild);
	}
	el.appendChild(document.createTextNode('Sent ' + sBytes + ' bytes'));
	
	el = document.getElementById(receiver + '-progress');
	while (el.hasChildNodes()) {
		el.removeChild(el.firstChild);
	}
	el.appendChild(document.createTextNode('Received ' + rBytes + ' bytes (' + rBytesDelta * 2 + 'bytes/s)'));
	rBytesDelta = 0;
}

var WebRTC = {};

// RTCPeerConnection
if (window.webkitRTCPeerConnection) {
  WebRTC.RTCPeerConnection = window.webkitRTCPeerConnection;
}
else if (window.mozRTCPeerConnection) {
  WebRTC.RTCPeerConnection = window.mozRTCPeerConnection;
}
else if (window.RTCPeerConnection) {
  WebRTC.RTCPeerConnection = window.RTCPeerConnection;
}

// RTCSessionDescription
if (window.mozRTCSessionDescription) {
  WebRTC.RTCSessionDescription = window.mozRTCSessionDescription;
}
else if (window.RTCSessionDescription) {
  WebRTC.RTCSessionDescription = window.RTCSessionDescription;
}

// RTCIceCandidate
if (window.mozRTCIceCandidate) {
  WebRTC.RTCIceCandidate = window.mozRTCIceCandidate;
}
else if (window.RTCIceCandidate) {
  WebRTC.RTCIceCandidate = window.RTCIceCandidate;
}

function setupEnv(state, otherState, isInitiator) {
    var pc = new WebRTC.RTCPeerConnection(configuration);
	function localDescCreated(desc) {
		pc.setLocalDescription(desc, function () {
			var localDesc = new WebRTC.RTCSessionDescription(pc.localDescription);
			state.con.augmentSdp(localDesc);
			otherState.receiveRemoteDesc(localDesc);
		}, logError);
	}

	state.receiveRemoteDesc = function (desc) {
		pc.setRemoteDescription(desc, function () {
			state.con.setRemoteDescription(desc);
			if (desc.type === 'offer') {
				pc.createAnswer(localDescCreated, logError);
			}
		}, logError);
	};

    // send any ice candidates to the other peer
    pc.onicecandidate = function (evt) {
        if (evt.candidate)
            otherState.pc.addIceCandidate(new WebRTC.RTCIceCandidate(evt.candidate));
    };

    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
		if (this.signalingState === 'stable') {
			pc.createOffer(localDescCreated, logError);
		}
    }

	var con = new CrocMSRP.DirectConnection(pc);

    if (isInitiator) {
        // create data channel and setup chat
        var session = con.createSession('chat');
		state.session = session;
        addEventHandlers(session, 'alice');
    } else {
        // setup chat on incoming data channel
        con.onSession = function(session) {
			state.session = session;
			addEventHandlers(session, 'bob');
		};
    }

	state.pc = pc;
	state.con = con;
}

function logError(error) {
    console.log(error.name + ": " + error.message);
}

// Set up the test environment
var configuration = {
	iceServers: []
};

// State namespaces
var alice = {};
var bob = {};
setupEnv(bob, alice, false);
setupEnv(alice, bob, true);


var bigBody = '1234567890';
while (bigBody.length < 10000) {
	bigBody = bigBody + bigBody;
}

