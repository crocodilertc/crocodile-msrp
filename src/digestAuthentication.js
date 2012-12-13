/*
 * Crocodile MSRP - http://code.google.com/p/crocodile-msrp/
 * Copyright (c) 2012 Crocodile RCS Ltd
 * http://www.crocodile-rcs.com
 * Released under the MIT license - see LICENSE.TXT
 */

/*global hex_md5: false, console: false*/

var CrocMSRP;

var CrocMSRP = (function(CrocMSRP) {
	var paramSep = ', ';
	
	/**
	 * Performs HTTP digest authentication.
	 * @private
	 */
	CrocMSRP.digestAuthentication = function(config, req, authenticate) {
		var authorization = 'Digest ',
			digestUri = req.toPath[req.toPath.length - 1],
			qop = null,
			nc = '00000001',
			cnonce = Math.random().toString(36).substr(2, 12),
			HA1, HA2, response;
		
		if (authenticate.qop) {
			if (authenticate.qop.split(' ').indexOf('auth') !== -1) {
				qop = 'auth';
			}
		}

		authorization += 'username="' + config.username + '"';
		authorization += paramSep + 'realm="' + authenticate.realm + '"';
		authorization += paramSep + 'nonce="' + authenticate.nonce + '"';
		authorization += paramSep + 'uri="' + digestUri + '"';
		
		// HA1 = MD5(A1) = MD5(username:realm:password)
		HA1 = hex_md5(config.username + ':' + authenticate.realm + ':' + config.password);
		// HA2 = MD5(A2) = MD5(method:digestUri)
		// Some confusion over what to use as the method; Kamailio uses "MSRP"
		if (config.digestMethod) {
			HA2 = hex_md5(config.digestMethod + ':' + digestUri);
		} else {
			HA2 = hex_md5(req.method + ':' + digestUri);
		}

		if (qop) {
			// response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
			response = hex_md5(HA1 + ':' + authenticate.nonce + ':' + nc + ':' + cnonce + ':auth:' + HA2);
		} else {
			// response = MD5(HA1:nonce:HA2)
			response = hex_md5(HA1 + ':' + authenticate.nonce + ':' + HA2);
		}
		authorization += paramSep + 'response="' + response + '"';
		
		if (authenticate.algorithm) {
			if (authenticate.algorithm !== 'MD5') {
				console.log('Auth failure: unsupported "algorithm" parameter in challenge');
				return null;
			}
			authorization += paramSep + 'algorithm=MD5';
		}
		
		if (qop) {
			authorization += paramSep + 'qop=' + qop;
			authorization += paramSep + 'cnonce="' + cnonce + '"';
			authorization += paramSep + 'nc=' + nc;
		}

		if (authenticate.opaque) {
			authorization += paramSep + 'opaque="' + authenticate.opaque + '"';
		}
		
		return authorization;
	};
	
	return CrocMSRP;
}(CrocMSRP));

