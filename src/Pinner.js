'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const BN = require('bn.js');
// const Promise = require("bluebird");

/**
 * Take care of pinning & accounting
 *
 */
class Pinner {
	/**
	 * Constructs the object.
	 *
	 * @param      {Object}  options  The options
	 */
	constructor(options) {
		this.count = 0;
		this.pinLimit = options.pinLimit;
		this.logger = options.logger;
		this.ipfs = options.ipfs;
		this.throttledIPFS = options.throttledIPFS;
		this.pinAccounting = {};
		this.hashExpiry = {};
	}

	/**
	 * Sets the limit that you can pin at most
	 *
	 * @param      {BigNumber}  sizeLimit  The size limit
	 */
	setLimit(sizeLimit) {
		this.logger.info('setting sizeLimit to %j', sizeLimit);
		this.sizeLimit = sizeLimit;
	}

	/**
	 * Determines ability to add to quota.
	 *
	 * @param      {String}   address  The address
	 * @param      {BN}   amount   The amount that you want to add
	 * @return     {boolean}  True if able to add to quota, False otherwise.
	 */
	canAddToQuota(address, amount) {
		if (!this.pinAccounting[address] || !amount) {
			return false;
		}
		return (this.pinAccounting[address]
			.used.add(amount).cmp(this.sizeLimit) === -1);
	}

	/**
	 * Adds to quota.
	 *
	 * @param      {String}  address  The address
	 * @param      {BN}  amount   The amount to add
	 */
	addToQuota(address, amount) {
		this.pinAccounting[address].used =
			this.pinAccounting[address].used.add(amount);
		this.pinAccounting[address].usedPercent = this.pinAccounting[address].used.mul(new BN(100)).div(this.sizeLimit);
	}

	/**
	 * Subtract from quota
	 *
	 * @param      {String}  address  The address
	 * @param      {BN}  amount   The amount to add
	 */
	subFromQuota(address, amount) {
		this.pinAccounting[address].used =
			this.pinAccounting[address].used.sub(amount);
	}

	/**
	 * pin content
	 *
	 * @param      {string}   owner     The owner pubkey
	 * @param      {string}   IPFShash  The ipfs hash
	 * @param      {number}   ttl       The ttl
	 * @return     {Promise}  {resolves when pinned}
	 */
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
						if (ttl && ttl > 0) {
							this.hashExpiry[IPFShash] = ttl;
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

	/**
	 * unpin content + remove from quota
	 *
	 * @param      {string}   owner     The owner
	 * @param      {string}   IPFShash  The ipf shash
	 * @return     {Promise}  { description_of_the_return_value }
	 */
	unpin(owner, IPFShash) {
		return new Promise((resolve, reject) => {
			if (!this.pinAccounting[owner] || !this.pinAccounting[owner][IPFShash]) {
				return resolve();
			}
			this.ipfs.pin.rm(IPFShash, (err, res) => {
				if (err && err.code === 0) {
					this.logger.warn('already unpinned hash %s', IPFShash);
					this.count--;
					return resolve();
				} else {
					delete this.hashExpiry[IPFShash];
					delete this.pinAccounting[owner][IPFShash];
					this.logger.info('unpinned hash %s', IPFShash, res);
					return resolve();
				}
			});
		});
	}

	/**
	 * make address uniform by lowercasing it
	 *
	 * @param      {string}  address  The address
	 * @return     {string}  { description_of_the_return_value }
	 */
	cleanAddress(address) {
		return address.toLowerCase();
	}

	/**
	 * Gets the usage of a pubkey
	 *
	 * @param      {Function}  owner   The owner
	 * @return     {BN}        The usage.
	 */
	getUsage(owner) {
		owner = this.cleanAddress(owner);
		if (!this.pinAccounting[owner]) {
			return new BN(0);
		}
		return this.pinAccounting[owner].used;
	}
	/**
	 * Gets the accounting statistics.
	 *
	 * @return     {Object}  The accounting statistics.
	 */
	getAccountingStats() {
		return {
			pinAccounting: this.pinAccounting,
			count: this.count,
		};
	}
}

module.exports = Pinner;
