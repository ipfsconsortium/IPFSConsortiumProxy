'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */

/**
 * Bootstrap the consortium code
 *
 */
class IPFSConsortiumProxy {
	/**
	 * constructor
	 *
	 * @param      {object}  options  The options
	 */
	constructor(options) {
		const {
			createLogger,
			format,
			transports,
		} = require('winston');
		this.logger = createLogger({
			level: 'info',
			format: format.combine(
				format.colorize(),
				format.splat(),
				format.simple()
			),
			transports: [new transports.Console()],
		});
		this.options = options;
	}

	/**
	 * Bootstrap the consortium code
	 *
	 */
	go() {
		const Web3 = require('web3');
		const ipfsAPI = require('ipfs-api');

		const ipfs = ipfsAPI({
			host: this.options.IPFSAPIHOST,
			port: this.options.IPFSAPIPORT,
			protocol: 'http',
		});

		const IPFSProxy = require(
			'../node_modules/ipfsconsortiumcontracts/build/contracts/IPFSProxy.json');
		const IPFSEvents = require(
			'../node_modules/ipfsconsortiumcontracts/build/contracts/IPFSEvents.json');

		const web3 = new Web3(new Web3.providers.WebsocketProvider(this.options.WEB3HOSTWS));
		const contract = new web3.eth.Contract(IPFSProxy.abi, this.options.CONTRACTADDRESS);

		let localData = {
			memberInfo: {},
			hashexpiry: {},
			epochtohash: {},
			lastblock: this.options.STARTBLOCK,
			sizelimit: new web3.utils.BN(0),
			hashInfo: {},
		};

		contract.methods.sizeLimit().call((err, res) => {
			if (err) {
				this.logger.error('cannot read contract %s %s. Exiting',
					this.options.CONTRACTADDRESS, err.message);
				process.exit();
			}

			localData.sizelimit = new web3.utils.BN(res);
			this.logger.info('sizelimit= %d bytes', localData.sizelimit.toNumber(10));

			contract.events.allEvents({
				fromBlock: this.options.STARTBLOCK,
			}, (error, result) => {
				if (error == null) {
					switch (result.event) {
						case 'ContractAdded':
							this.logger.info('ContractAdded address=%s, ttl=%s, member=%s',
								result.returnValues.pubKey,
								result.returnValues.ttl,
								result.returnValues.member);
							addContract(result.returnValues.member,
								result.returnValues.pubKey,
								result.blockNumber);
							break;
						case 'MetadataContractAdded':
							this.logger.info('MetadataContractAdded member=%s metadataHash=%s',
								result.returnValues.member,
								result.returnValues.metadataHash);
							metadataContractAdded(result.returnValues.member,
								result.returnValues.metadataHash);
							break;
						case 'ContractRemoved':
							this.logger.info('ContractRemoved member=%s address=%s',
								result.returnValues.member,
								result.returnValues.pubKey);
							removeContract(result.returnValues.pubKey, result.returnValues.member);
							break;
						case 'MemberAdded':
							this.logger.info('MemberAdded pubkey=%s',
								result.returnValues.newMember);
							addMember(result.returnValues.newMember);
							break;
						case 'Banned':
						case 'BanAttempt':
							this.logger.warn('Event handler not implemented: %s', result.event);
							break;
						case 'PersistLimitChanged':
							this.logger.info('Changing PersistLimit to %s bytes per member',
								result.returnValues.limit);
							localData.sizelimit = new web3.utils.BN(result.returnValues.limit);
							break;
						case 'HashAdded':
						case 'HashRemoved':
							// the contract listener will catch these, We can ignore these here.
							break;
						case 'MemberRemoved':
							this.logger.info('MemberRemoved pubkey=%s',
								result.returnValues.oldMember);
							removeMember(result.returnValues.oldMember);
							break;
						case 'Confirmation':
							break;
						default:
							this.logger.warn('unknown Event: %s', result.event);
							break;
					}
				} else {
					this.logger.error('Error: %s', error.message);
				}
			});
		});

		let cleanAddress = (address) => {
			return address.toLowerCase();
		};

		let isMember = (address) => {
			return (localData.memberInfo[cleanAddress(address)] != null);
		};

		let addMember = (address) => {
			if (!isMember(address)) {
				localData.memberInfo[cleanAddress(address)] = {
					used: new web3.utils.BN(0),
					contracts: {},
				};
			}
		};

		let removeMember = (address) => {
			if (isMember(address)) {
				Object.keys(localData.memberInfo[cleanAddress(address)].contracts).forEach((contract) => {
					removeContract(contract, address);
				});
				delete localData.memberInfo[cleanAddress(address)];
			}
		};

		let canAddToQuota = (address, amount) => {
			if (!localData.memberInfo[cleanAddress(address)]) {
				addMember(address);
			}
			return (localData.memberInfo[cleanAddress(address)]
				.used.add(amount).cmp(localData.sizelimit) === -1);
		};

		let addToQuota = (address, amount) => {
			localData.memberInfo[cleanAddress(address)].used =
				localData.memberInfo[cleanAddress(address)].used.add(amount);
		};

		let subToQuota = (address, amount) => {
			localData.memberInfo[cleanAddress(address)].used =
				localData.memberInfo[cleanAddress(address)].used.sub(amount);
		};

		let addHash = (IPFShash, memberAddress, blockNumber, ttl, contractaddress = memberAddress, index = '') => {
			// If the file is pending to be added it is not necessary to add it again but its values are updated
			if (localData.hashInfo[IPFShash] && localData.hashInfo[IPFShash].status) {
				localData.hashInfo[IPFShash].member = cleanAddress(memberAddress);
				localData.hashInfo[IPFShash].owner[cleanAddress(contractaddress)] = 1;
				localData.hashInfo[IPFShash].blockNumber = blockNumber;
				localData.hashInfo[IPFShash].ttl = ttl;
				if (localData.hashInfo[IPFShash].status == 'pending') {
					return;
				}
			} else {
				localData.hashInfo[IPFShash] = {
					member: cleanAddress(memberAddress),
					owner: {},
					blockNumber: blockNumber,
					ttl: ttl,
					removeHash: false,
					index: index,
					status: 'pending',
				};
				localData.hashInfo[IPFShash].owner[cleanAddress(contractaddress)] = 1;
			}
			this.logger.info('HashAdded %s', IPFShash);

			localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].hashes[IPFShash] = localData.hashInfo[IPFShash];
			if (index != '') {
				localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].index[index] = IPFShash;
			}

			ipfs.cat(IPFShash).then((r) => {
				this.logger.info('hash %s fetched %d bytes', IPFShash, r.byteLength);
				let hashByteSize = new web3.utils.BN(r.byteLength);
				localData.hashInfo[IPFShash].hashByteSize = hashByteSize;
				if (canAddToQuota(cleanAddress(memberAddress), hashByteSize)) {
					ipfs.pin.add(IPFShash, (err, res) => {
						if (!err) {
							this.logger.info('pinning complete... %s', JSON.stringify(res));
							addToQuota(cleanAddress(memberAddress), hashByteSize);
							addexpiration(IPFShash, localData.hashInfo[IPFShash].blockNumber, localData.hashInfo[IPFShash].ttl);
						} else {
							this.logger.error('Error pinning hash %s', err.message);

							delete localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].hashes[IPFShash];
							if (index != '') {
								delete localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].index[index];
							}
							delete localData.hashInfo[IPFShash];
						}
					});
				} else {
					this.logger.error('Pinning hash %s would exceed users %s quota => ignoring', IPFShash, memberAddress);

					delete localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].hashes[IPFShash];
					if (index != '') {
						delete localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].index[index];
					}
					delete localData.hashInfo[IPFShash];
				}
			}).catch((err) => {
				this.logger.error(err.message);

				delete localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].hashes[IPFShash];
				if (index != '') {
					delete localData.memberInfo[cleanAddress(memberAddress)].contracts[(cleanAddress(contractaddress))].index[index];
				}
				delete localData.hashInfo[IPFShash];
			});
		};

		let addContract = (member, contractaddress, startblock) => {
			if (localData.memberInfo[cleanAddress(member)] && localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))]) {
				this.logger.info('already watching address %s', contractaddress);
				return;
			}

			// Only members can add a 'Contract' so if the member
			// doesn't exist yet it's created
			if (!isMember(member)) {
				addMember(member);
			}

			const contract = new web3.eth.Contract(IPFSEvents.abi, contractaddress);

			localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))] = {
				listeners: [],
				hashes: {},
				index: {},
			};

			localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))].listeners = contract.events.allEvents({
				fromBlock: 0,
			}, (error, result) => {
				if (error == null) {
					switch (result.event) {
						case 'HashAdded':
							addHash(result.returnValues.hashAdded, member, result.blockNumber, result.returnValues.ttl, contractaddress);
							break;
						case 'HashRemoved':
							removehash(result.returnValues.hashRemoved, contractaddress);
							break;
					}
				} else {
					this.logger.error('Error reading event: %s', error.message);
				}
			});
		};

		let metadataContractAdded = (member, metadataHash) => {

			// Only members can add a 'metadataContract' so if the member
			// doesn't exist yet it's created
			if (!isMember(member)) {
				addMember(member);
			}

			// Obtaining contract metadata info
			ipfs.cat(metadataHash).then((file) => {
				let contractMetadata = JSON.parse(file.toString('utf8'));
				if (!contractMetadata.abi ||
					!contractMetadata.contract ||
					!contractMetadata.events ||
					!contractMetadata.networkId ||
					!contractMetadata.ttl ||
					!contractMetadata.startblock) {
					this.logger.warn('Not valid metadataHash contract: %s', metadataHash);
					return;
				} else {
					// The metadata hashes of a contract are pinned by default
					// to prevent them from being lost
					ipfs.pin.add(metadataHash, (err, res) => {
						if (!err) {
							this.logger.info('pinning metadataHash complete... %s', JSON.stringify(res));
						} else {
							this.logger.error('Error pinning metadataHash %s', err.message);
						}
					});
				}

				const contract = new web3.eth.Contract(contractMetadata.abi, contractMetadata.contract);

				let listeners = [];

				// for each contract event, an own listener is generated
				contractMetadata.events.forEach((event) => {
					let listener = contract.events[event.event]({
						fromBlock: contractMetadata.startblock,
					}, (error, result) => {
						if (event.type == 'HashAdded') {
							if (result.returnValues[event.ipfsParam] == '') return;
							addHash(result.returnValues[event.ipfsParam], member, result.blockNumber, contractMetadata.ttl, contractMetadata.contract);
						} else if (event.type == 'HashRemoved') {
							removehash(result.returnValues[event.ipfsParam], contractMetadata.contract);
							// events of type 'HashWithIndex' allow to maintain an index of hashes based on a defined key
						} else if (event.type == 'HashWithIndex') {
							let index = result.returnValues[event.indexKey];
							// it gets the old hash, if it exists it'll be replaced by the new one
							let oldHash = localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractMetadata.contract))].index[index];
							if (oldHash) {
								removehash(oldHash, contractMetadata.contract);
								if (result.returnValues[event.ipfsParam] == '') return;
								addHash(result.returnValues[event.ipfsParam], member, result.blockNumber, contractMetadata.ttl, contractMetadata.contract, index);
							} else {
								if (result.returnValues[event.ipfsParam] == '') return;
								addHash(result.returnValues[event.ipfsParam], member, result.blockNumber, contractMetadata.ttl, contractMetadata.contract, index);
							}
						}
					});
					listeners.push(listener);
				});

				localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractMetadata.contract))] = {
					listeners: listeners,
					hashes: {},
					index: {},
				};
			});
		};

		let removeContract = (contractaddress, member) => {
			this.logger.info('Member %s removeContract address %s ', member, contractaddress);
			if (!localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))]) return;

			Object.keys(localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))].hashes).forEach((hash) => {
				removehash(hash, contractaddress);
			});

			delete localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))];
		};

		let addexpiration = (ipfshash, blockNumber, ttl) => {
			web3.eth.getBlock(blockNumber, (error, blockInfo) => {
				const expiryTimeStamp =
					parseInt(ttl) +
					blockInfo.timestamp * 1000;

				let now = new Date().getTime();

				if (expiryTimeStamp < now && ttl != parseInt(0)) {
					this.logger.info('already expired, not pinning');
					removehash(ipfshash);
				} else {
					let epoch = timestamptoepoch(expiryTimeStamp);
					//  is this ipfshash unknown or is this the latest expiry of an existing ipfshash ?
					if (!localData.hashexpiry[ipfshash] ||
						localData.hashexpiry[ipfshash] < expiryTimeStamp) {
						// remove old epoch if it exists
						let oldepoch = timestamptoepoch(localData.hashexpiry[ipfshash]);
						if (localData.epochtohash[oldepoch] && localData.epochtohash[oldepoch][ipfshash]) {
							delete localData.epochtohash[oldepoch][ipfshash];
						}
						if (ttl == parseInt(0)) {
							localData.hashexpiry[ipfshash] = '-';
						} else {
							// mark latest expiration date
							localData.hashexpiry[ipfshash] = expiryTimeStamp;
						}

						// and flag this hash in it's epoch, to make removal easier.
						if (!localData.epochtohash[epoch]) {
							localData.epochtohash[epoch] = {};
						}
						localData.epochtohash[epoch][ipfshash] = true;
					}
				}

				localData.hashInfo[ipfshash].status = 'complete';
				if (localData.hashInfo[ipfshash].removeHash) {
					removehash(ipfshash);
				}
			});
		};

		let removehash = (IPFShash, hashOwner = '') => {
			if (!localData.hashInfo[IPFShash]) {
				return;
			}


			if (hashOwner != '') {
				localData.hashInfo[IPFShash].owner[cleanAddress(hashOwner)] = 0;
			}


			// it's marked to be erased
			if (localData.hashInfo[IPFShash].status == 'pending') {
				localData.hashInfo[IPFShash].removeHash = true;
				return;
			}

			let needToDelete = 1;
			Object.keys(localData.hashInfo[IPFShash].owner).forEach((owner) => {
				if (localData.hashInfo[IPFShash].owner[owner]) {
					needToDelete = 0;
				} else {
					if (localData.memberInfo[cleanAddress(localData.hashInfo[IPFShash].member)].contracts[(cleanAddress(owner))].hashes[IPFShash]) {
						delete localData.memberInfo[cleanAddress(localData.hashInfo[IPFShash].member)].contracts[(cleanAddress(owner))].hashes[IPFShash];
					}
				}
			});
			if (!needToDelete) return;


			this.logger.info('removing hash %s', IPFShash);
			ipfs.pin.rm(IPFShash, (err, res) => {
				if (err && err.code === 0) {
					this.logger.warn('already unpinned hash %s', IPFShash);
				} else {
					this.logger.info('unpinned hash %s', IPFShash, res);
				}
			});

			let member = localData.hashInfo[IPFShash].member;
			let hashByteSize = localData.hashInfo[IPFShash].hashByteSize;

			if (localData.hashexpiry[IPFShash]) {
				let myEpoch = timestamptoepoch(localData.hashexpiry[IPFShash]);
				if (localData.epochtohash[myEpoch]) {
					delete localData.epochtohash[myEpoch][IPFShash];
				}
				delete localData.hashexpiry[IPFShash];
			}

			Object.keys(localData.hashInfo[IPFShash].owner).forEach((hashOwner) => {
				if (localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(hashOwner))].hashes[IPFShash]) {
					delete localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(hashOwner))].hashes[IPFShash];
				}
			});

			delete localData.hashInfo[IPFShash];

			subToQuota(member, hashByteSize);
		};

		let timestamptoepoch = (timestamp) => {
			return Math.floor(timestamp / (1000 * 60 * 60));
		};

		let dumpstate = () => {
			web3.eth.getBlockNumber()
				.then((blockNumber) => {
					let cache = [];

					// Avoid circular references and 'remove' listeners
					let newJSON = JSON.parse(JSON.stringify(localData.memberInfo, function (key, value) {
						if (typeof value === 'object' && value !== null) {
							if (cache.indexOf(value) !== -1) {
								// Circular reference found, discard key
								return;
							}
							// Store value in our collection
							cache.push(value);
						}
						if (key === 'listeners') return;
						return value;
					}));

					cache = null; // Enable garbage collection

					this.logger.info('state %s', JSON.stringify({ memberInfo: newJSON, hashInfo: localData.hashInfo, hashexpiry: localData.hashexpiry }, true, 2));
				});
		};

		let cleanepoch = () => {
			dumpstate();
			let now = Date.now();
			let currentEpoch = timestamptoepoch(now);
			this.logger.info('current epoch is %d', currentEpoch);
			if (localData.epochtohash[currentEpoch]) {
				for (let hash in localData.epochtohash[currentEpoch]) {
					if (localData.epochtohash[currentEpoch].hasOwnProperty(hash)) {
						if (localData.hashexpiry[hash] && localData.hashexpiry[hash] < now) {
							removehash(hash);
						}
					}
				}
			}
		};

		// clean the hashtaglist every hour.
		setInterval(cleanepoch, 1000 * 60 * 60);
		setInterval(dumpstate, 1000 * 10);
	}
}
module.exports = IPFSConsortiumProxy;
