'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */

/**
 * Take care of ownership of objectNames
 *
 */
class OwnershipTracker {
	/**
	 * Constructs the object.
	 *
	 * @param      {object}  options  The options
	 */
	constructor(options) {
		this.objectOwners = {};
	}

	/**
	 * Gets the owner of an IPFS hash.
	 *
	 * @param      {string}  objectName  The object name
	 * @return     {string}  The owner.
	 */
	getOwner(objectName) {
		if (!objectName) return null;
		return this.objectOwners[objectName];
	}

	/**
	 * Sets the owner of an IPFS hash
	 *
	 * @param      {string}  objectName  The object name
	 * @param      {string}  owner       The owner
	 */
	setOwner(objectName, owner) {
		if (!this.objectOwners[objectName]) {
			this.objectOwners[objectName] = owner;
		}
	}

	/**
	 * Gets the owner statistics.
	 *
	 * @return     {object}  The owner statistics.
	 */
	getOwnerStats() {
		return this.objectOwners;
	}
}

module.exports = OwnershipTracker;
