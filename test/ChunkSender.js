/*global QUnit: false, CrocMSRP: false*/

QUnit.module("ChunkSender");

(function () {
	var FakeSession = function(chunkSize) {
		this.config = {
			chunkSize: chunkSize || 2048,
			reportTimeout: 1000
		};
		this.toPath = ['TO-PATH'];
		this.localUri = 'LOCAL-URI';
	};

	QUnit.test("No session provided", function(assert) {
		assert.throws(
			function() {new CrocMSRP.ChunkSender();},
			TypeError,
			"Throws TypeError"
		);
	});
	
	QUnit.test("Empty send", function(assert) {
		var fakeSession = new FakeSession();
		var sender = new CrocMSRP.ChunkSender(fakeSession);
		var chunk = sender.getNextChunk();
		
		assert.ok(chunk instanceof CrocMSRP.Message.OutgoingRequest, 'MSRP request');
		assert.deepEqual(fakeSession.toPath, chunk.toPath, 'To-Path');
		assert.deepEqual([fakeSession.localUri], chunk.fromPath, 'From-Path');
		assert.ok(!chunk.body, 'No body');
		assert.strictEqual(chunk.byteRange.start, 1, 'Range start');
		assert.strictEqual(chunk.byteRange.end, 0, 'Range end');
		assert.strictEqual(chunk.byteRange.total, 0, 'Range total');
		assert.ok(sender.isSendComplete(), 'Sending complete');
	});
	
	// QUnit.test("File send", function(assert) {
		// Can't easily construct a suitable File object for unit testing
	// });
	
	QUnit.test("Blob send", function(assert) {
		var fakeSession = new FakeSession();
		var body = 'blob chunk';
		var type = 'text/plain';
		var blob = new Blob([body], {type: type});
		var sender = new CrocMSRP.ChunkSender(fakeSession, blob);
		var chunk = sender.getNextChunk();
		
		assert.ok(chunk instanceof CrocMSRP.Message.OutgoingRequest, 'MSRP request');
		assert.ok(chunk.body instanceof Blob, 'Body is a Blob');
		// Checking the blob content is relatively hard - just check the size
		assert.strictEqual(chunk.body.size, body.length, 'Body size');
		assert.strictEqual(chunk.contentType, type, 'Content type');
		assert.strictEqual(chunk.byteRange.start, 1, 'Range start');
		assert.strictEqual(chunk.byteRange.end, body.length, 'Range end');
		assert.strictEqual(chunk.byteRange.total, body.length, 'Range total');
		assert.ok(sender.isSendComplete(), 'Sending complete');
	});
	
	QUnit.test("String send", function(assert) {
		var fakeSession = new FakeSession();
		var body = 'string chunk';
		var type = 'text/plain';
		var sender = new CrocMSRP.ChunkSender(fakeSession, body, type);
		var chunk = sender.getNextChunk();
		
		assert.ok(chunk instanceof CrocMSRP.Message.OutgoingRequest, 'MSRP request');
		assert.ok(chunk.body instanceof Blob, 'Body is a Blob');
		// Checking the blob content is relatively hard - just check the size
		assert.strictEqual(chunk.body.size, body.length, 'Body size');
		assert.strictEqual(chunk.contentType, type, 'Content type');
		assert.strictEqual(chunk.byteRange.start, 1, 'Range start');
		assert.strictEqual(chunk.byteRange.end, body.length, 'Range end');
		assert.strictEqual(chunk.byteRange.total, body.length, 'Range total');
		assert.ok(sender.isSendComplete(), 'Sending complete');
	});
	
	QUnit.test("Multi-chunk send", function(assert) {
		var chunkSize = 6;
		var fakeSession = new FakeSession(chunkSize);
		var body = 'string chunk';
		var type = 'text/plain';
		var sender = new CrocMSRP.ChunkSender(fakeSession, body, type);
		var chunk = sender.getNextChunk();
		
		assert.ok(chunk instanceof CrocMSRP.Message.OutgoingRequest, 'MSRP request');
		// Checking the blob content is relatively hard - just check the size
		assert.strictEqual(chunk.body.size, chunkSize, 'Body size');
		assert.strictEqual(chunk.contentType, type, 'Content type');
		assert.strictEqual(chunk.byteRange.start, 1, 'Range start');
		assert.strictEqual(chunk.byteRange.end, 6, 'Range end');
		assert.strictEqual(chunk.byteRange.total, body.length, 'Range total');
		assert.ok(!sender.isSendComplete(), 'Sending not complete');
		
		chunk = sender.getNextChunk();
		assert.strictEqual(chunk.body.size, chunkSize, 'Body size');
		assert.strictEqual(chunk.contentType, type, 'Content type');
		assert.strictEqual(chunk.byteRange.start, 7, 'Range start');
		assert.strictEqual(chunk.byteRange.end, 12, 'Range end');
		assert.strictEqual(chunk.byteRange.total, body.length, 'Range total');
		assert.ok(sender.isSendComplete(), 'Sending complete');
		assert.ok(!sender.isComplete(), 'Report not received');
		
		// Now check that the report is processed as expected
		var fakeReport = {
			messageId: sender.messageId,
			status: CrocMSRP.Status.OK,
			byteRange: {start: 1, end: 12, total: 12}
		};
		sender.processReport(fakeReport);
		assert.ok(sender.isComplete(), 'Report received');
	});
	
	QUnit.test("Local abort", function(assert) {
		var chunkSize = 6;
		var fakeSession = new FakeSession(chunkSize);
		var body = 'string chunk';
		var type = 'text/plain';
		var sender = new CrocMSRP.ChunkSender(fakeSession, body, type);
		var chunk = sender.getNextChunk();
		sender.abort();
		
		chunk = sender.getNextChunk();
		assert.strictEqual(chunk.continuationFlag, CrocMSRP.Message.Flag.abort, 'Abort chunk');
		assert.ok(sender.isSendComplete(), 'Sending complete');
		assert.ok(sender.isComplete(), 'Complete');
		assert.ok(!sender.remoteAbort, 'Local abort');
	});
	
	QUnit.test("Remote abort", function(assert) {
		var chunkSize = 6;
		var fakeSession = new FakeSession(chunkSize);
		var body = 'string chunk';
		var type = 'text/plain';
		var sender = new CrocMSRP.ChunkSender(fakeSession, body, type);
		var fakeReport = {messageId: sender.messageId, status: CrocMSRP.Status.STOP_SENDING};
		var chunk = sender.getNextChunk();
		sender.processReport(fakeReport);
		
		assert.ok(sender.isSendComplete(), 'Sending complete');
		assert.ok(sender.isComplete(), 'Complete');
		assert.ok(sender.remoteAbort, 'Remote abort');
	});
	
	QUnit.test("Out-of-order reports", function(assert) {
		var fakeSession = new FakeSession();
		var body = 'string chunk';
		var type = 'text/plain';
		var sender = new CrocMSRP.ChunkSender(fakeSession, body, type);
		var chunk = sender.getNextChunk();
		
		assert.ok(sender.isSendComplete(), 'Sending complete');
		assert.ok(!sender.isComplete(), 'Final report not received');

		var fakeReport = {
			messageId: sender.messageId,
			status: CrocMSRP.Status.OK,
			byteRange: {start: 1, end: 3, total: 12}
		};
		sender.processReport(fakeReport);
		assert.ok(!sender.isComplete(), 'Final report not received');
		
		fakeReport.byteRange.start = 7;
		fakeReport.byteRange.end = 9;
		sender.processReport(fakeReport);
		assert.ok(!sender.isComplete(), 'Final report not received');
		
		fakeReport.byteRange.start = 4;
		fakeReport.byteRange.end = 6;
		sender.processReport(fakeReport);
		assert.ok(!sender.isComplete(), 'Final report not received');
		
		fakeReport.byteRange.start = 10;
		fakeReport.byteRange.end = 12;
		sender.processReport(fakeReport);
		assert.ok(sender.isComplete(), 'Final report received');
	});
	
	QUnit.asyncTest("Report timeout", 3, function(assert) {
		var fakeSession = new FakeSession();
		var body = 'string chunk';
		var type = 'text/plain';
		var sender = new CrocMSRP.ChunkSender(fakeSession, body, type);
		sender.onReportTimeout = function() {
			assert.ok(true, 'Report timeout ran');
		};
		var chunk = sender.getNextChunk();
		
		assert.ok(sender.isSendComplete(), 'Sending complete');
		assert.ok(!sender.isComplete(), 'Final report not received');
		setTimeout(function() {
			QUnit.start();
		}, 1500);
	});
	
}());
