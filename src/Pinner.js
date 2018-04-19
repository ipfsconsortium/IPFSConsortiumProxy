'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const BN = require('bn.js');
const queue = require('async/queue');

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
		this.currentProcess = {};
		this.pinnerQueue = queue((task, callback) => {
			this.logger.info('start task for hash %s', task.IPFShash);
			this.currentProcess[task.IPFShash] = Date.now();
			this._pin(task.owner, task.IPFShash, task.ttl).then(() => {
				delete this.currentProcess[task.IPFShash];
				callback();
			}).catch((e) => {
				delete this.currentProcess[task.IPFShash];
				this.logger.warn('re-queueing item %s', task.IPFShash);
				this.pinnerQueue.push(task);
			})
		}, 4);
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
		if (!IPFShash || IPFShash.length == 0) {
			this.logger.info('no IPFS hash given');
			return;
		}
		this.logger.info('adding %s to queue', IPFShash);
		this.pinnerQueue.push({
			owner: owner,
			IPFShash: IPFShash,
			ttl: ttl,
		});
	};

	_pin(owner, IPFShash, ttl) {
		return new Promise((resolve, reject) => {

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
					this.throttledIPFS.pin.add(IPFShash).then((res) => {
						this.logger.info('pinning complete... %s', JSON.stringify(res));
						this.addToQuota(owner, hashByteSize);
						if (ttl > 0) {
							this.hashExpiry[IPFShash] = ttl;
						} else {
							this.logger.info('this hash does not expire. Not setting an expiry date.');
						}
						this.count++;
						resolve();
					}).catch((err) => {
						this.logger.error('Error pinning hash %s', err.message);
						reject();
					});
				} else {
					this.logger.error('Pinning hash %s would exceed users %s quota => ignoring', IPFShash, owner);
				}
			}).catch((err) => {
				this.logger.error(err.message);
				reject();
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
			hashExpiry: this.hashExpiry,
			count: this.count,
			queue: this.pinnerQueue.length(),
			processing: this.currentProcess,
		};
	}

	cleanAddress(address) {
		return address.toLowerCase();
	};
}

module.exports = Pinner;
