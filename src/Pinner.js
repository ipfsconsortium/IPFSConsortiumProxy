'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const BN = require('bn.js');

/**
 * Take care of pinning & accounting
 *
 */
class Pinner {

	constructor(options) {
		this.pinLimit = options.pinLimit;
		this.logger = options.logger;
		this.ipfs = options.ipfs;
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
	};

	subFromQuota(address, amount) {
		this.pinAccounting[address].used =
			this.pinAccounting[address].used.sub(amount);
	};

	pin(owner, IPFShash, ttl) {
		owner = this.cleanAddress(owner);
		if (!this.pinAccounting[owner]) {
			this.pinAccounting[owner] = {
				used: new BN(0),
			};
		}
		this.logger.info('pinning %s for owner %s', IPFShash, owner);

		this.ipfs.cat(IPFShash).then((r) => {
			this.logger.info('hash %s fetched %d bytes', IPFShash, r.byteLength);
			let hashByteSize = new BN(r.byteLength);
			if (this.canAddToQuota(owner, hashByteSize)) {
				this.ipfs.pin.add(IPFShash, (err, res) => {
					if (!err) {
						this.logger.info('pinning complete... %s', JSON.stringify(res));
						this.addToQuota(owner, hashByteSize);
						if (ttl > 0) {
							this.hashExpiry[IPFShash] = ttl;
						}
					} else {
						this.logger.error('Error pinning hash %s', err.message);
					}
				});
			} else {
				this.logger.error('Pinning hash %s would exceed users %s quota => ignoring', IPFShash, owner);
			}
		}).catch((err) => {
			this.logger.error(err.message);
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
			hashExpiry: this.hashExpiry
		};
	}

	cleanAddress(address) {
		return address.toLowerCase();
	};
}

module.exports = Pinner;
