'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */

/**
 * Take care of ownership of objectNames
 *
 */
class OwnershipTracker {
	constructor(options) {
		this.objectOwners = {};
	}

	getOwner(objectName) {
		if (!objectName) return null;
		return this.objectOwners[objectName];
	}

	setOwner(objectName, owner) {
		if (!this.objectOwners[objectName]) {
			this.objectOwners[objectName] = owner;
		}
	}

	getOwnerStats() {
		return this.objectOwners;
	}
}

module.exports = OwnershipTracker;
