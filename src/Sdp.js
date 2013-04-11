/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

var CrocMSRP = (function(CrocMSRP) {
	var lineEnd = '\r\n';
	
	/**
	 * @namespace Encapsulates all of the SDP classes.
	 * @private
	 */
	CrocMSRP.Sdp = {};
	
	CrocMSRP.Sdp.Session = function(sdp) {
		if (sdp) {
			// Parse the provided SDP
			if (!this.parse(sdp)) {
				return null;
			}
		} else {
			// Set some sensible defaults
			this.reset();
		}
	};
	CrocMSRP.Sdp.Session.prototype.reset = function() {
		this.version = 0;
		this.origin = new CrocMSRP.Sdp.Origin();
		this.sessionName = ' ';
		this.sessionInfo = null;
		this.uri = null;
		this.email = null;
		this.phone = null;
		this.connection = new CrocMSRP.Sdp.Connection();
		this.bandwidth = [];
		this.timing = [new CrocMSRP.Sdp.Timing()];
		this.timezone = null;
		this.key = null;
		this.attributes = {};
		this.media = [];
	};
	CrocMSRP.Sdp.Session.prototype.parse = function(sdp) {
		var line, lines = sdp.split(lineEnd), value, colonIndex;
		
		this.reset();
		
		if (lines[lines.length - 1] === '') {
			// SDP ends in CRLF; remove final array index
			lines.pop();
		}
		
		if (lines.length < 4) {
			console.log('Unexpected SDP length: ' + lines.length);
			return false;
		}
		
		line = lines.shift();
		if (line !== 'v=0') {
			console.log('Unexpected SDP version: ' + line);
			return false;
		}
		
		line = lines.shift();
		if (line.substr(0, 2) !== 'o=' ||
				!(this.origin = new CrocMSRP.Sdp.Origin(line.substr(2)))) {
			console.log('Unexpected SDP origin: ' + line);
			return false;
		}
		
		line = lines.shift();
		if (line.substr(0, 2) === 's=') {
			this.sessionName = line.substr(2);
		} else {
			console.log('Unexpected SDP session name: ' + line);
			return false;
		}
		
		// Process any other optional pre-timing lines
		while (lines.length > 0 && lines[0].charAt(0) !== 't') {
			line = lines.shift();
			value = line.substr(2);
			
			switch (line.substr(0, 2)) {
			case 'i=':
				this.sessionInfo = value;
				break;
			case 'u=':
				this.uri = value;
				break;
			case 'e=':
				this.email = value;
				break;
			case 'p=':
				this.phone = value;
				break;
			case 'c=':
				value = new CrocMSRP.Sdp.Connection(value);
				if (!value) {
					return false;
				}
				this.connection = value;
				break;
			case 'b=':
				this.bandwidth.push(value);
				break;
			default:
				console.log('Unexpected SDP line (pre-timing): ' + line);
				return false;
			}
		}
		
		if (lines.length === 0) {
			console.log('Unexpected end of SDP (pre-timing)');
			return false;
		}
		
		this.timing = [];
		while (lines.length > 0 && lines[0].charAt(0) === 't') {
			line = lines.shift().substr(2);
			// Append any following r-lines
			while (lines.length > 0 && lines[0].charAt(0) === 'r') {
				line += lineEnd + lines.shift();
			}
			
			value = new CrocMSRP.Sdp.Timing(line);
			if (!value) {
				return false;
			}
			this.timing.push(value);
		}

		if (this.timing.length === 0) {
			console.log('No timing line found');
			return false;
		}
		
		// Process any optional pre-media lines
		while (lines.length > 0 && lines[0].charAt(0) !== 'm') {
			line = lines.shift();
			value = line.substr(2);
			
			switch (line.substr(0, 2)) {
			case 'z=':
				this.timezone = value;
				break;
			case 'k=':
				this.key = value;
				break;
			case 'a=':
				colonIndex = value.indexOf(':');
				if (colonIndex === -1) {
					this.attributes[value] = null;
				} else {
					this.attributes[value.substr(0, colonIndex)] = value.substr(colonIndex + 1);
				}
				break;
			default:
				console.log('Unexpected SDP line (pre-media): ' + line);
				return false;
			}
		}
		
		while (lines.length > 0 && lines[0].charAt(0) === 'm') {
			line = lines.shift().substr(2);
			// Append any following lines up to the next m-line
			while (lines.length > 0 && lines[0].charAt(0) !== 'm') {
				line += lineEnd + lines.shift();
			}

			value = new CrocMSRP.Sdp.Media(line);
			if (!value) {
				return false;
			}
			this.media.push(value);
		}

		return true;
	};
	CrocMSRP.Sdp.Session.prototype.toString = function() {
		var sdp = '', index;
		
		sdp += 'v=' + this.version + lineEnd;
		sdp += 'o=' + this.origin + lineEnd;
		sdp += 's=' + this.sessionName + lineEnd;
		if (this.sessionInfo) {
			sdp += 'i=' + this.sessionInfo + lineEnd;
		}
		if (this.uri) {
			sdp += 'u=' + this.uri + lineEnd;
		}
		if (this.email) {
			sdp += 'e=' + this.email + lineEnd;
		}
		if (this.phone) {
			sdp += 'p=' + this.phone + lineEnd;
		}
		if (this.connection) {
			sdp += 'c=' + this.connection + lineEnd;
		}
		for (index in this.bandwidth) {
			sdp += 'b=' + this.bandwidth[index] + lineEnd;
		}
		for (index in this.timing) {
			sdp += 't=' + this.timing[index] + lineEnd;
		}
		if (this.timezone) {
			sdp += 'z=' + this.timezone + lineEnd;
		}
		if (this.key) {
			sdp += 'k=' + this.key + lineEnd;
		}
		for (index in this.attributes) {
			sdp += 'a=' + index;
			if (this.attributes[index]) {
				sdp += ':' + this.attributes[index] + lineEnd;
			}
		}
		for (index in this.media) {
			sdp += 'm=' + this.media[index] + lineEnd;
		}
		
		return sdp;
	};

	CrocMSRP.Sdp.Origin = function(origin) {
		if (origin) {
			// Parse the provided origin line
			if (!this.parse(origin)) {
				return null;
			}
		} else {
			// Set some sensible defaults
			this.reset();
		}
	};
	CrocMSRP.Sdp.Origin.prototype.reset = function() {
		this.username = '-';
		this.id = CrocMSRP.util.dateToNtpTime(new Date());
		this.version = this.sessId;
		this.netType = 'IN';
		this.addrType = 'IP4';
		this.address = 'address.invalid';
	};
	CrocMSRP.Sdp.Origin.prototype.parse = function(origin) {
		var split;
		
		split = origin.split(' ');
		if (split.length !== 6) {
			console.log('Unexpected origin line: ' + origin);
			return false;
		}

		this.username = split[0];
		this.id = split[1];
		this.version = split[2];
		this.netType = split[3];
		this.addrType = split[4];
		this.address = split[5];
		
		return true;
	};
	CrocMSRP.Sdp.Origin.prototype.toString = function() {
		var o = '';
		
		o += this.username + ' ';
		o += this.id + ' ';
		o += this.version + ' ';
		o += this.netType + ' ';
		o += this.addrType + ' ';
		o += this.address;
		
		return o;
	};

	CrocMSRP.Sdp.Connection = function(con) {
		if (con) {
			// Parse the provided connection line
			if (!this.parse(con)) {
				return null;
			}
		} else {
			// Set some sensible defaults
			this.reset();
		}
	};
	CrocMSRP.Sdp.Connection.prototype.reset = function() {
		this.netType = 'IN';
		this.addrType = 'IP4';
		this.address = 'address.invalid';
	};
	CrocMSRP.Sdp.Connection.prototype.parse = function(con) {
		var split;
		
		split = con.split(' ');
		if (split.length !== 3) {
			console.log('Unexpected connection line: ' + con);
			return false;
		}

		this.netType = split[0];
		this.addrType = split[1];
		this.address = split[2];
		
		return true;
	};
	CrocMSRP.Sdp.Connection.prototype.toString = function() {
		var c = '';
		
		c += this.netType + ' ';
		c += this.addrType + ' ';
		c += this.address;
		
		return c;
	};

	CrocMSRP.Sdp.Timing = function(timing) {
		if (timing) {
			// Parse the provided timing line
			if (!this.parse(timing)) {
				return null;
			}
		} else {
			// Set some sensible defaults
			this.reset();
		}
	};
	CrocMSRP.Sdp.Timing.prototype.reset = function() {
		this.start = null;
		this.stop = null;
		this.repeat = [];
	};
	// Parse expects to be passed the full t-line, plus any following r-lines
	CrocMSRP.Sdp.Timing.prototype.parse = function(timing) {
		var lines, tLine, tokens;
		
		lines = timing.split(lineEnd);
		tLine = lines.shift();
		
		tokens = tLine.split(' ');
		if (tokens.length !== 2) {
			console.log('Unexpected timing line: ' + tLine);
			return false;
		}

		if (tokens[0] === '0') {
			this.start = null;
		} else {
			this.start = CrocMSRP.util.ntpTimeToDate(tokens[0]);
		}
		
		if (tokens[1] === '0') {
			this.stop = null;
		} else {
			this.stop =  CrocMSRP.util.ntpTimeToDate(tokens[1]);
		}
		
		// Don't care about repeat lines at the moment
		this.repeat = lines;
		
		return true;
	};
	CrocMSRP.Sdp.Timing.prototype.toString = function() {
		var t = '', index;
		
		if (this.start) {
			t +=  CrocMSRP.util.dateToNtpTime(this.start);
		} else {
			t += '0';
		}
		t += ' ';
		if (this.stop) {
			t +=  CrocMSRP.util.dateToNtpTime(this.stop);
		} else {
			t += '0';
		}
		
		for (index in this.repeat) {
			t += lineEnd + this.repeat[index];
		}
		
		return t;
	};

	CrocMSRP.Sdp.Media = function(media) {
		if (media) {
			// Parse the provided connection line
			if (!this.parse(media)) {
				return null;
			}
		} else {
			// Set some sensible defaults
			this.reset();
		}
	};
	CrocMSRP.Sdp.Media.prototype.reset = function() {
		this.media = 'message';
		this.port = 2855;
		this.proto = 'TCP/MSRP';
		this.format = '*';
		this.title = null;
		this.connection = null;
		this.bandwidth = [];
		this.key = null;
		this.attributes = {};
	};
	CrocMSRP.Sdp.Media.prototype.parse = function(media) {
		var lines, mLine, tokens, index;
		
		this.reset();
		
		lines = media.split(lineEnd);
		mLine = lines.shift();
		
		tokens = mLine.split(' ');
		if (tokens.length < 4) {
			console.log('Unexpected media line: ' + mLine);
			return false;
		}

		this.media = tokens.shift();
		this.port = tokens.shift();
		this.proto = tokens.shift();
		this.format = tokens.join(' ');
		
		for (index in lines) {
			var value = lines[index].substr(2), colonIndex;
			
			switch (lines[index].substr(0, 2)) {
			case 'i=':
				this.title = value;
				break;
			case 'c=':
				this.connection = new CrocMSRP.Sdp.Connection(value);
				if (!this.connection) {
					return false;
				}
				break;
			case 'b=':
				this.bandwidth.push(value);
				break;
			case 'k=':
				this.key = value;
				break;
			case 'a=':
				colonIndex = value.indexOf(':');
				if (colonIndex === -1) {
					this.attributes[value] = null;
				} else {
					this.attributes[value.substr(0, colonIndex)] = value.substr(colonIndex + 1);
				}
				break;
			default:
				console.log('Unexpected type (within media): ' + lines[index]);
				return false;
			}
		}
		
		return true;
	};
	CrocMSRP.Sdp.Media.prototype.toString = function() {
		var m = '', index;
		
		m += this.media + ' ';
		m += this.port + ' ';
		m += this.proto + ' ';
		m += this.format;
		
		if (this.title) {
			m += lineEnd + 'i=' + this.title;
		}
		if (this.connection) {
			m += lineEnd + 'c=' + this.connection;
		}
		for (index in this.bandwidth) {
			m += lineEnd + 'b=' + this.bandwidth[index];
		}
		if (this.key) {
			m += lineEnd + 'k=' + this.key;
		}
		for (index in this.attributes) {
			m += lineEnd + 'a=' + index;
			if (this.attributes[index]) {
				m += ':' + this.attributes[index];
			}
		}
		
		return m;
	};

	return CrocMSRP;
}(CrocMSRP || {}));

