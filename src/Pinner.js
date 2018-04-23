'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const BN = require('bn.js');
const queue = require('async/queue');
const Promise = require("bluebird");

/**
 * Take care of pinning & accounting
 *
 */
class Pinner {

	constructor(options) {
		this.count = 0;
		this.pinLimit = options.pinLimit;
		this.logger = options.logger;
		this.ipfs = options.ipfs;
		this.throttledIPFS = options.throttledIPFS;
		this.pinAccounting = {};
		this.hashExpiry = {};
	}

	setLimit(sizeLimit) {
		this.logger.info('setting sizeLimit to %j', sizeLimit);
		this.sizeLimit = sizeLimit;
	}

	canAddToQuota(address, amount) {
		if (!this.pinAccounting[address]) {
			return false;
		}
		return (this.pinAccounting[address]
			.used.add(amount).cmp(this.sizeLimit) === -1);
	}

	addToQuota(address, amount) {
		this.pinAccounting[address].used =
			this.pinAccounting[address].used.add(amount);
		this.pinAccounting[address].usedPercent = this.pinAccounting[address].used.mul(new BN(100)).div(this.sizeLimit);

	};

	subFromQuota(address, amount) {
		this.pinAccounting[address].used =
			this.pinAccounting[address].used.sub(amount);
	};

	pin(owner, IPFShash, ttl) {
		return new Promise((resolve, reject) => {
			if (!IPFShash || IPFShash.length == 0) {
				this.logger.info('no IPFS hash given');
				return reject(new Error('no IPFS hash given'));
			}

			owner = this.cleanAddress(owner);
			if (!this.pinAccounting[owner]) {
				this.pinAccounting[owner] = {
					used: new BN(0),
				};
			}
			this.logger.info('pinning %s for owner %s', IPFShash, owner);

			this.throttledIPFS.cat(IPFShash).then((r) => {
				this.logger.info('hash %s fetched %d bytes', IPFShash, r.byteLength);
				let hashByteSize = new BN(r.byteLength);
				if (this.canAddToQuota(owner, hashByteSize)) {
					this.throttledIPFS.pin(IPFShash).then((res) => {
						this.logger.info('pinning complete... %s', JSON.stringify(res));
						this.addToQuota(owner, hashByteSize);
						if (ttl > 0) {
							this.hashExpiry[IPFShash] = ttl;
						} else {
							this.logger.info('this hash does not expire. Not setting an expiry date.');
						}
						this.count++;
						return resolve();
					}).catch((err) => {
						this.logger.error('Error pinning hash %s', err.message);
						return reject(err);
					});
				} else {
					this.logger.error('Pinning hash %s would exceed users %s quota => ignoring', IPFShash, owner);
					return reject(new Error('Pinning this hash would exceed users quota'));
				}
			}).catch((err) => {
				this.logger.error(err.message);
				return reject(err);
			});
		});
	}

	unpin(owner, IPFShash) {
		return new Promise((resolve, reject) => {
			if (!this.pinAccounting[owner] || !this.pinAccounting[owner][IPFShash]) {
				return resolve();
			}
			ipfs.pin.rm(IPFShash, (err, res) => {
				if (err && err.code === 0) {
					this.logger.warn('already unpinned hash %s', IPFShash);
					return resolve();
					this.count--;
				} else {
					delete this.hashExpiry[IPFShash];
					delete this.pinAccounting[owner][IPFShash];
					this.logger.info('unpinned hash %s', IPFShash, res);
					return resolve();
				}
			});
		});
	}

	getUsage(owner) {
		owner = cleanAddress(owner);
		if (!this.pinAccounting[owner]) {
			return new BN(0);
		}
		return this.pinAccounting[owner].used;
	}

	getAccountingStats() {
		return {
			pinAccounting: this.pinAccounting,
			count: this.count,
		};
	}

	cleanAddress(address) {
		return address.toLowerCase();
	};
}

module.exports = Pinner;
