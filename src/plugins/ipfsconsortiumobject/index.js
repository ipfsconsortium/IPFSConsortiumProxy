/*
 * The plugin for the metadata-object format on IPFS
 */
module.exports = {
	addWatch: (options) => {
		// Obtaining contract metadata info
		options.ipfs.cat(options.hash).then((file) => {
			let contractMetadata = JSON.parse(file.toString('utf8'));
			if (!contractMetadata.abi ||
				!contractMetadata.contract ||
				!contractMetadata.events ||
				!contractMetadata.ttl ||
				!contractMetadata.startblock) {
				this.logger.warn('Invalid options for contract: %s', options.hash);
				return;
			} else {
				// The metadata hashes of a contract are pinned by default
				// to prevent them from being lost
				resolveExpiration(contractMetadata.startblock, contractMetadata.ttl).then((expiryTimeStamp) => {
					options.pinner.pin(options.ownershiptracker.getOwner(contractMetadata.contract) || options.transaction.from, options.hash, 0);
				});
			}
			// set the owner of this contract ( for quota accounting )
			options.ownershiptracker.setOwner(contractMetadata.contract, options.transaction.from);

			const contract = new web3.eth.Contract(contractMetadata.abi, contractMetadata.contract);

			let listeners = [];

			// for each contract event, an own listener is generated
			contractMetadata.events.forEach((event) => {
				let listener = contract.events[event.event]({
					fromBlock: contractMetadata.startblock,
				}, (error, result) => {
					if (event.type == 'HashAdded') {
						if (result.returnValues[event.ipfsParam] == '') return;
						options.pinner.pin(options.ownershiptracker.getOwner(contractMetadata.contract) || options.transaction.from, result.returnValues[event.ipfsParam], 0);
						//addHash(result.returnValues[event.ipfsParam], member, result.blockNumber, contractMetadata.ttl, contractMetadata.contract);
					} else if (event.type == 'HashRemoved') {
						//removehash(result.returnValues[event.ipfsParam], contractMetadata.contract);
						// events of type 'HashWithIndex' allow to maintain an index of hashes based on a defined key
					} else if (event.type == 'HashWithIndex') {
						let index = result.returnValues[event.indexKey];
						// it gets the old hash, if it exists it'll be replaced by the new one
						let oldHash = localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractMetadata.contract))].index[index];
						if (oldHash) {
							//removehash(oldHash, contractMetadata.contract);
							if (result.returnValues[event.ipfsParam] == '') return;
							options.pinner.pin(options.ownershiptracker.getOwner(contractMetadata.contract) || options.transaction.from, result.returnValues[event.ipfsParam], 0);
							//addHash(result.returnValues[event.ipfsParam], member, result.blockNumber, contractMetadata.ttl, contractMetadata.contract, index);
						} else {
							if (result.returnValues[event.ipfsParam] == '') return;
							options.pinner.pin(options.ownershiptracker.getOwner(contractMetadata.contract) || options.transaction.from, result.returnValues[event.ipfsParam], 0);
							//addHash(result.returnValues[event.ipfsParam], member, result.blockNumber, contractMetadata.ttl, contractMetadata.contract, index);
						}
					}
				});
				listeners.push(listener);
			});
		});

		function cleanAddress(address) {
			if (!address) return;
			return address.toLowerCase();
		}

		function resolveExpiration(blockNumber, ttl) {
			return new Promise((resolve, reject) => {
				ttl = parseInt(ttl);
				if (ttl === 0) {
					return resolve(0);
				}
				options.web3.eth.getBlock(blockNumber).then((blockInfo) => {
					const expiryTimeStamp =
						ttl +
						blockInfo.timestamp * 1000;
					return resolve(expiryTimeStamp);
				});
			});
		}
	},

	getStats: () => {
		return ({});
	},
}
