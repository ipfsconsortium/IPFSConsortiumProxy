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
		}, 5);

		this.pinQ = queue((IPFShash, callback) => {
			this.ipfs.pin.add(IPFShash).then((r) => {
				callback(null, r);
			}).catch((e) => {
				callback(e);
			});
		}, 5);
	}

	cat(hash) {
		return new Promise((resolve, reject) => {
			this.catQ.push(hash, (err, r) => {
				if (err) {
					return reject(err);
				}
				return resolve(r);
			});
			this.logger.info('ThrottledIPFS : cat queue %d running - length %d', this.catQ.running(), this.catQ.length());
		});
	}

	pin(hash) {
		return new Promise((resolve, reject) => {
			this.pinQ.push(hash, (err, r) => {
				if (err) {
					return reject(err);
				}
				return resolve(r);
			});
			this.logger.info('ThrottledIPFS : pin queue %d running - length %d', this.pinQ.running(), this.pinQ.length());
		});
	}

	getStats() {
		return {
			cat: this.catQ.workersList(),
			pin: this.pinQ.workersList(),
		};
	}
}

module.exports = ThrottledIPFS;
