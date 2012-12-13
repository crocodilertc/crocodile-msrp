var offer, answer, reader, lastFilename, sender, sBytes, receiver, rBytes, rBytesDelta, progressInterval;

function makeEventObj(user) {
	return {
		onAuthenticated: function() {
			console.log(user + ' onAuthenticated');
			exchangeSdp(sessA, sessB);
		},
		onAuthFailed: function() {
			console.log(user + ' onAuthFailed');
		},
		onError: function() {
			console.log(user + ' onError');
		},
		onMessageReceived: function(contentType, body) {
			console.log(user + ' onMessageReceived (' + typeof body + ', ' + contentType + '):');
			if (body instanceof String || typeof body === 'string') {
				console.log(body);
			} else {
				reader = new FileReader();
				reader.onload = function() {console.log(reader.result);};
				reader.readAsText(body);
			}
		},
		onMessageSent: function(msgId) {
			console.log(user + ' onMessageSent: msgId=' + msgId);
		},
		onMessageDelivered: function(msgId) {
			console.log(user + ' onMessageDelivered: msgId=' + msgId);
		},
		onMessageFailed: function(msgId, status, comment) {
			console.log(user + ' onMessageFailed: msgId=' + msgId + ', status=' + status + ', comment=' + comment);
		},
		onFileReceiveStarted: function(id, contentType, filename, size, description) {
			var el = document.getElementById(user + '-details');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Receiving File: id=' + id + ', contentType=' + contentType + ', filename=' + filename + ', size=' + size + ', description=' + description));
			lastFilename = filename;
			progressInterval = setInterval(updateProgress, 500);
			receiver = user;
			rBytes = rBytesDelta = 0;
		},
		onFileReceiveChunk: function(id, receivedBytes) {
			rBytesDelta += receivedBytes - rBytes;
			rBytes = receivedBytes;
		},
		onFileReceiveCompleted: function(id, contentType, file) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			var url = URL.createObjectURL(file);
			var a = document.createElement('a');
			a.href = url;
			a.target = '_blank';
			a.download = lastFilename;
			a.appendChild(document.createTextNode('Download file'));
			el.appendChild(a);
			console.log(user + ' onFileReceiveCompleted: id=' + id + ', contentType=' + contentType + ', size=' + file.size);
			clearInterval(progressInterval);
			updateProgress();
		},
		onFileReceiveAborted: function(id) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Receive aborted!'));
			clearInterval(progressInterval);
		},
		onFileReceiveTimeout: function(id) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Receive timeout!'));
			clearInterval(progressInterval);
		},
		onFileSendChunk: function(id, sentBytes) {
			sBytes = sentBytes;
			sender = user;
		},
		onFileSendCompleted: function(id) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Send successful!'));
		},
		onFileSendFailed: function(id, status, comment) {
			var el = document.getElementById(user + '-result');
			while (el.hasChildNodes()) {
				el.removeChild(el.firstChild);
			}
			el.appendChild(document.createTextNode('Send failed!'));
		}
	};
};

// Simulate SDP offer/answer exchange through some rendevous protocol (e.g. SIP)
function exchangeSdp(sessA, sessB) {
	var offer = sessA.getSdpOffer();
	if (!offer) {
		console.log('null offer');
		return;
	}

	var answer = sessB.getSdpAnswer(offer);
	if (!answer) {
		console.log('null answer');
		return;
	}

	sessA.processSdpAnswer(answer);
}

// Stuff to enable drag and drop file transfer
function noopHandler(evt) {
	evt.stopPropagation();
	evt.preventDefault();
}

function dropHandler(user, session) {
	return function(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		
		var msgId = session.send(evt.dataTransfer.files[0], null, 'Drag n Drop file');
	}
}

function addListeners(element, user, session) {
	element.addEventListener('dragenter', noopHandler, false);
	element.addEventListener('dragexit', noopHandler, false);
	element.addEventListener('dragover', noopHandler, false);
	element.addEventListener('drop', dropHandler(user, session), false);
}

function onload() {
	// Set up the drag and drop targets
	addListeners(document.getElementById('alice-dropbox'), 'alice', sessA);
	addListeners(document.getElementById('bob-dropbox'), 'bob', sessB);
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

// Create a connection for each party
var configA = {
	username: 'alice', password: 'alice', authExpires: 60//, chunkSize: 64//, maxOutstandingSends: 1
};
var configB = {
	username: 'bob', password: 'bob'
};
var conA = new CrocMSRP.Connection('ws://192.168.0.74:80', 'msrp://alice@192.168.0.74;tcp', configA);
var conB = new CrocMSRP.Connection('ws://192.168.0.74:80', 'msrp://bob@192.168.0.74;tcp', configB);

// Create a session for each party, using distinct event objects
var sessA = conA.createSession(makeEventObj('alice'));
var sessB = conB.createSession(makeEventObj('bob'));

var bigBody = '1234567890';
while (bigBody.length < 10000) {
	bigBody = bigBody + bigBody;
}

