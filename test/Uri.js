/*global QUnit: false, CrocMSRP: false*/

QUnit.module("Uri");

QUnit.test("Basic MSRP URI", function(assert) {
	var uri = "msrp://test.invalid/1234;tcp";
	var parsed = new CrocMSRP.Uri(uri);
	assert.strictEqual(parsed.secure, false, "Check secure");
	assert.strictEqual(parsed.user, null, "Check user");
	assert.strictEqual(parsed.authority, "test.invalid", "Check authority");
	assert.strictEqual(parsed.port, null, "Check port");
	assert.strictEqual(parsed.sessionId, "1234", "Check sessionId");
	assert.strictEqual(parsed.transport, "tcp", "Check transport");
	assert.strictEqual(parsed.toString(), uri, "Check re-encode");
});

QUnit.test("URI with user", function(assert) {
	var uri = "msrp://alice@test.invalid/1234;tcp";
	var parsed = new CrocMSRP.Uri(uri);
	assert.strictEqual(parsed.secure, false, "Check secure");
	assert.strictEqual(parsed.user, "alice", "Check user");
	assert.strictEqual(parsed.authority, "test.invalid", "Check authority");
	assert.strictEqual(parsed.port, null, "Check port");
	assert.strictEqual(parsed.sessionId, "1234", "Check sessionId");
	assert.strictEqual(parsed.transport, "tcp", "Check transport");
	assert.strictEqual(parsed.toString(), uri, "Check re-encode");
});

QUnit.test("URI with port", function(assert) {
	var uri = "msrp://test.invalid:9876/1234;tcp";
	var parsed = new CrocMSRP.Uri(uri);
	assert.strictEqual(parsed.secure, false, "Check secure");
	assert.strictEqual(parsed.user, null, "Check user");
	assert.strictEqual(parsed.authority, "test.invalid", "Check authority");
	assert.strictEqual(parsed.port, "9876", "Check port");
	assert.strictEqual(parsed.sessionId, "1234", "Check sessionId");
	assert.strictEqual(parsed.transport, "tcp", "Check transport");
	assert.strictEqual(parsed.toString(), uri, "Check re-encode");
});

QUnit.test("Secure URI", function(assert) {
	var uri = "msrps://test.invalid/1234;tcp";
	var parsed = new CrocMSRP.Uri(uri);
	assert.strictEqual(parsed.secure, true, "Check secure");
	assert.strictEqual(parsed.user, null, "Check user");
	assert.strictEqual(parsed.authority, "test.invalid", "Check authority");
	assert.strictEqual(parsed.port, null, "Check port");
	assert.strictEqual(parsed.sessionId, "1234", "Check sessionId");
	assert.strictEqual(parsed.transport, "tcp", "Check transport");
	assert.strictEqual(parsed.toString(), uri, "Check re-encode");
});

QUnit.test("Unexpected URI", function(assert) {
	assert.throws(
		function() {
			new CrocMSRP.Uri("ws://test.invalid/1234;tcp");
		},
		TypeError, "Unexpected scheme"
	);
	assert.throws(
		function() {
			new CrocMSRP.Uri("random string");
		},
		TypeError, "Random text"
	);
});

