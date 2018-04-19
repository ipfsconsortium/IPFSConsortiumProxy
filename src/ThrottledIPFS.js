'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const queue = require('async/queue');

/**
 * Take care of pinning & accounting
 *
 */
class ThrottledIPFS {

	constructor(options) {
		this.logger = options.logger;
		this.ipfs = options.ipfs;

		this.catQ = queue((IPFShash, callback) => {
			this.ipfs.cat(IPFShash).then((r) => {
				callback(null, r);
			}).catch((e) => {
				callback(e);
			});
		}, 4);
	}

	cat(hash) {
		return new Promise((resolve, reject) => {
			this.catQ.push(hash, (err, r) => {
				if (err){
					return reject(err);
				}
				return resolve(r);
			});
			this.logger.info('ThrottledIPFS : queue %d running - length %d',this.catQ.running(),this.catQ.length());
		});
	}
}

module.exports = ThrottledIPFS;
