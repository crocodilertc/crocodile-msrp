/*global QUnit: false, CrocMSRP: false*/

QUnit.module("ChunkReceiver");

(function () {
	var lineEnd = '\r\n';
	var rawMsg = 'MSRP xol1lmt9 SEND' + lineEnd;
	rawMsg += 'To-Path: msrp://1ckpb61p.invalid:2855/30y1eetsdu;ws' + lineEnd;
	rawMsg += 'From-Path: msrp://f1z7aduu.invalid:2855/f4enevqwx1;ws' + lineEnd;
	rawMsg += 'Message-ID: 3560751376.r8igluab' + lineEnd;
	rawMsg += 'Byte-Range: $RANGE' + lineEnd;
	rawMsg += 'Content-Disposition: attachment; filename=test.txt' + lineEnd;
	rawMsg += 'Content-Type: text/plain' + lineEnd;
	rawMsg += lineEnd;
	rawMsg += '$BODY' + lineEnd;
	rawMsg += '-------xol1lmt9$FLAG' + lineEnd;

	function msg(start, end, total, body, flag, disp) {
		var m = rawMsg;
		m = m.replace('$RANGE', start + '-' + end + '/' + total);
		m = m.replace('$FLAG', flag);
		if (disp) {
			m = m.replace(/attachment.*/, disp);
		}
		m = m.replace('$BODY', body);
		return CrocMSRP.parseMessage(m);
	}

	QUnit.test("Four one-byte chunks in order", function(assert) {
		var recv = new CrocMSRP.ChunkReceiver(msg(1, 1, 4, '1', '+'), 0);
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, 1, 'Received 1');
		assert.strictEqual(recv.blob.size, 1, 'Blob size 1');
		assert.strictEqual(recv.totalBytes, 4, 'Total');

		recv.processChunk(msg(2, 2, 4, '2', '+'));
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, 2, 'Received 2');
		assert.strictEqual(recv.blob.size, 2, 'Blob size 2');

		recv.processChunk(msg(3, 3, 4, '3', '+'));
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, 3, 'Received 3');
		assert.strictEqual(recv.blob.size, 3, 'Blob size 3');

		recv.processChunk(msg(4, 4, 4, '4', '$'));
		assert.strictEqual(recv.isComplete(), true, 'Completed');
		assert.strictEqual(recv.receivedBytes, 4, 'Received 4');
		assert.strictEqual(recv.blob.size, 4, 'Blob size 4');
		assert.strictEqual(recv.aborted, false, 'Not aborted');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');
		assert.strictEqual(recv.bufferedChunks.length, 0, 'No buffered chunks');
	});
	
	QUnit.test("Four one-byte chunks out of order", function(assert) {
		var recv = new CrocMSRP.ChunkReceiver(msg(1, 1, 4, '1', '+'), 0);
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, 1, 'Received 1');
		assert.strictEqual(recv.blob.size, 1, 'Blob size 1');
		assert.strictEqual(recv.totalBytes, 4, 'Total');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');

		recv.processChunk(msg(3, 3, 4, '3', '+'));
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, 2, 'Received 2');
		assert.strictEqual(recv.blob.size, 1, 'Blob size 1');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), false, 'Incontiguous chunk');

		recv.processChunk(msg(2, 2, 4, '2', '+'));
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, 3, 'Received 3');
		assert.strictEqual(recv.blob.size, 3, 'Blob size 3');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');

		recv.processChunk(msg(4, 4, 4, '4', '$'));
		assert.strictEqual(recv.isComplete(), true, 'Completed');
		assert.strictEqual(recv.receivedBytes, 4, 'Received 4');
		assert.strictEqual(recv.blob.size, 4, 'Blob size 4');
		assert.strictEqual(recv.aborted, false, 'Not aborted');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');
	});
	
	QUnit.test("Big message with buffering", function(assert) {
		var chunksize = 2048, totalsize = 10*1024*1024;
		var start = 1, body = '12345678';
		while (body.length < chunksize) {
			body = body + body;
		}
		
		var recv = new CrocMSRP.ChunkReceiver(msg(start, start - 1 + chunksize, totalsize, body, '+'), 1024*1024);
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, chunksize, 'Received chunk');
		assert.strictEqual(recv.totalBytes, totalsize, 'Total correct');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');
		assert.strictEqual(recv.bufferedChunks.length, 1, 'Buffered chunk');
		start += chunksize;

		while (start - 1 + chunksize < totalsize) {
			recv.processChunk(msg(start, start - 1 + chunksize, totalsize, body, '+'));
			start += chunksize;
		}
		assert.strictEqual(recv.isComplete(), false, 'Not completed');
		assert.strictEqual(recv.receivedBytes, start - 1, 'Received most');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');

		recv.processChunk(msg(start, totalsize, totalsize, body.slice(0, totalsize - start + 1), '$'));
		assert.strictEqual(recv.isComplete(), true, 'Completed');
		assert.strictEqual(recv.receivedBytes, totalsize, 'Received all');
		assert.strictEqual(recv.blob.size, totalsize, 'Blob size correct');
		assert.strictEqual(recv.aborted, false, 'Not aborted');
		assert.strictEqual(CrocMSRP.util.isEmpty(recv.incontiguousChunks), true, 'No incontiguous chunks');
		assert.strictEqual(recv.bufferedChunks.length, 0, 'No buffered chunks');
	});
	
}());
