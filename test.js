var offer, answer, reader, lastFilename, sender, sBytes, receiver, rBytes, rBytesDelta, progressInterval, sFileMsgId, rFileMsgId;

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
		onMessageReceived: function(id, contentType, body) {
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
		},
		onMessageSent: function(id) {
			console.log(user + ' onMessageSent: id=' + id);
		},
		onMessageDelivered: function(id) {
			console.log(user + ' onMessageDelivered: id=' + id);
			if (id === sFileMsgId) {
				var el = document.getElementById(user + '-result');
				while (el.hasChildNodes()) {
					el.removeChild(el.firstChild);
				}
				el.appendChild(document.createTextNode('Send successful!'));
			}
		},
		onMessageSendFailed: function(id, status, comment) {
			console.log(user + ' onMessageSendFailed: id=' + id + ', status=' + status + ', comment=' + comment);
			if (id === sFileMsgId) {
				var el = document.getElementById(user + '-result');
				while (el.hasChildNodes()) {
					el.removeChild(el.firstChild);
				}
				el.appendChild(document.createTextNode('Send failed!'));
			}
		},
		onFirstChunkReceived: function(id, contentType, filename, size, description) {
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
		},
		onChunkReceived: function(id, receivedBytes) {
			if (id === rFileMsgId) {
				rBytesDelta += receivedBytes - rBytes;
				rBytes = receivedBytes;
			}
		},
		onMessageReceiveAborted: function(id, partialBody) {
			if (id === rFileMsgId) {
				var el = document.getElementById(user + '-result');
				while (el.hasChildNodes()) {
					el.removeChild(el.firstChild);
				}
				el.appendChild(document.createTextNode('Receive aborted!'));
				clearInterval(progressInterval);
			}
		},
		onMessageReceiveTimeout: function(id) {
			if (id === rFileMsgId) {
				var el = document.getElementById(user + '-result');
				while (el.hasChildNodes()) {
					el.removeChild(el.firstChild);
				}
				el.appendChild(document.createTextNode('Receive timeout!'));
				clearInterval(progressInterval);
			}
		},
		onChunkSent: function(id, sentBytes) {
			if (id === sFileMsgId) {
				sBytes = sentBytes;
				sender = user;
			}
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

