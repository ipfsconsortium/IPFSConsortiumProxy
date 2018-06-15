'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const BN = require('bn.js');
const logger = require('./logs')(module);

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
	constructor(owner,limit,ipfs) {
		this.count = 0;
		this.owner = owner;
		this.limit = limit || new BN(0);
		this.usage = new BN(0);
		this.ipfs = ipfs;	
	}

	/**
	 * Sets the limit that you can pin at most
	 *
	 * @param      {BigNumber}  limit  The size limit
	 */
	setLimit(limit) {
		logger.info('setting limit to %j', limit);
		this.limit = limit;
	}

	/**
	 * Determines ability to add to quota.
	 *
	 * @param      {BN}   amount   The amount that you want to add
	 * @return     {boolean}  True if able to add to quota, False otherwise.
	 */
	canAddToQuota(amount) {
		if (!amount) {
			return false;
		}
		return (this.usage.add(amount).cmp(this.limit) === -1);
	}

	/**
	 * Adds to quota.
	 *
	 * @param      {BN}  amount   The amount to add
	 */
	addToQuota(amount) {
		this.usage = this.usage.add(amount);
		this.usagePercent = this.usage.mul(new BN(100)).div(this.limit);
	}

	/**
	 * Subtract from quota
	 *
	 * @param      {BN}  amount   The amount to add
	 */
	subFromQuota(amount) {
		this.usage = this.usage.sub(amount);
	}

	/**
	 * pin content
	 *
	 * @param      {string}   IPFShash  The ipfs hash
	 * @return     {Promise}  {resolves when pinned}
	 */
	pin(IPFShash) {
		debugger;
		return new Promise((resolve, reject) => {
			if (!IPFShash || IPFShash.length == 0) {
				logger.info('no IPFS hash given');
				return reject(new Error('no IPFS hash given'));
			}

			this.ipfs.cat(IPFShash).then((r) => {
				logger.info('hash %s fetched %d bytes', IPFShash, r.byteLength);
				let hashByteSize = new BN(r.byteLength);
				if (this.canAddToQuota(hashByteSize)) {
					this.ipfs.pin(IPFShash).then((res) => {
						logger.info('pinning complete... %s', JSON.stringify(res));
						this.addToQuota(hashByteSize);
						this.count++;
						return resolve();
					}).catch((err) => {
						logger.error('Error pinning hash %s', err.message);
						return reject(err);
					});
				} else {
					//logger.error('Pinning hash %s would exceed users %s quota => ignoring', IPFShash, owner);
					return reject(new Error('Pinning this hash would exceed users quota'));
				}
			}).catch((err) => {
				logger.error(err.message);
				return reject(err);
			});
		});
	}

	/**
	 * unpin content + remove from quota
	 *
	 * @param      {string}   IPFShash  The ipf shash
	 * @return     {Promise}  { description_of_the_return_value }
	 */
	unpin(IPFShash) {
		return new Promise((resolve, reject) => {
			this.ipfs.pin.rm(IPFShash, (err, res) => {
				if (err && err.code === 0) {
					logger.warn('already unpinned hash %s', IPFShash);
					this.count--;
					return resolve();
				} else {
					logger.info('unpinned hash %s', IPFShash, res);
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
	getUsage() {
		return this.usage;
	}
	/**
	 * Gets the accounting statistics.
	 *
	 * @return     {Object}  The accounting statistics.
	 */
	getAccountingStats() {
		return {
			usage: this.usage.toString(),
		};
	}
}

module.exports = Pinner;
