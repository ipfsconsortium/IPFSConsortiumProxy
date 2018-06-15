'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const queue = require('async/queue');

/**
 *
 */
class ThrottledIPFS {
	/**
	 * Constructs the object.
	 *
	 * @param      {Object}  options  The options logger/ipfs
	 */
	constructor(options) {
		this.logger = options.logger;
		this.ipfs = options.ipfs;
		this.counters = {
			cat: 0,
			pin: 0,
		};

		this.catQ = queue((IPFShash, callback) => {
			this.ipfs.cat(IPFShash).then((r) => {
				this.counters.cat++;
				callback(null, r);
			}).catch((e) => {
				callback(e);
			});
		}, 5);

		this.pinQ = queue((IPFShash, callback) => {
			this.ipfs.pin.add(IPFShash).then((r) => {
				this.counters.pin++;
				callback(null, r);
			}).catch((e) => {
				callback(e);
			});
		}, 5);
	}

	/**
	 * IPFS cat
	 *
	 * @param      {String}   hash    The ipfs hash
	 * @return     {Promise}  { resolves with the IPFS api data }
	 */
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

	/**
	 * IPFS pin
	 *
	 * @param      {String}   hash    The ipfs hash
	 * @return     {Promise}  { resolves with the IPFS api data }
	 */
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

	/**
	 * Returns statistics like queue lengths / concurrent connections / etc.
	 *
	 * @return     {Object}  The statistics - ready to print out.
	 */
	getStats() {
		return {
			catqueuelength: this.catQ.length(),
			catqueuerunning: this.catQ.running(),
			catfinished: this.counters.cat,
			pinqueuelength: this.pinQ.length(),
			pinqueuerunning: this.pinQ.running(),
			pinfinished: this.counters.pin,
		};
	}
}

module.exports = ThrottledIPFS;
