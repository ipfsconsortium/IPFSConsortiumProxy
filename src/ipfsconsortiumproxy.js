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

		const winstonFormat = format.printf((info) => {
			let level = info.level.toUpperCase();
			let message = info.message;
			let filteredInfo = Object.assign({}, info, {
				'level': undefined,
				'message': undefined,
				'splat': undefined,
				'timestamp': undefined,
			});
			let append = JSON.stringify(filteredInfo, null, 4);
			if (append != '{}') {
				message = message + ' ' + append;
			}
			return `${info.timestamp} ${level} : ${message}`;
		});

		this.logger = createLogger({
			level: 'info',
			format: format.combine(
				format.splat(),
				format.timestamp(),
				winstonFormat
			),
			transports: [new transports.Console()],
		});
		this.options = options;

		this.plugins = {
			'ipfsconsortium': new (require('./plugins/ipfsconsortium'))(),
			'ipfsconsortiumobject': new (require('./plugins/ipfsconsortiumobject'))(),
		};

		this.logger.info('options %j %s ', this.options, typeof this.options.PLUGINS);

		// load additional plugins provided on the command line.
		if (this.options.PLUGINS) {
			this.options.PLUGINS.forEach((name) => {
				this.logger.info('loading plugin %s', name);
				const plugin = require('./plugins/' + name);
				this.plugins[name] = new plugin();
			});
		}

		this.logger.info('plugins loaded: %j', Object.keys(this.plugins));

		this.lastblock = 0;

	}

	/**
	 * Bootstrap the consortium code
	 *
	 */
	go() {
		const Web3 = require('web3');
		const ipfsAPI = require('ipfs-api');
		const Pinner = require('./Pinner');
		const ThrottledIPFS = require('./ThrottledIPFS');
		const OwnershipTracker = require('./OwnershipTracker');

		const ipfs = ipfsAPI({
			host: this.options.IPFSAPIHOST,
			port: this.options.IPFSAPIPORT,
			protocol: 'http',
		});

		// const ipfs = ipfsAPI({
		// 	host: 'ipfs.infura.io',
		// 	port: 5001,
		// 	protocol: 'https',
		// });
		// const topic = 'quaak'; // this.options.CONTRACTADDRESS;

		// const receiveMsg = (msg) => {
		// 	console.log('received message:', msg.data.toString())
		// }

		// ipfs.pubsub.subscribe(topic, receiveMsg).then(() => {
		// 	this.logger.info('subscribed to %s', topic);

		// 	const msg = new Buffer('banana')


		// 	ipfs.pubsub.ls((err, topics) => {
		// 		if (err) {
		// 			throw err
		// 		}
		// 		console.log('subscribed to');
		// 		console.log(topics);
		// 	})


		// 	ipfs.pubsub.publish(topic, msg, (err) => {
		// 		if (err) {
		// 			this.logger.error(err);
		// 		}
		// 		this.logger.info('message BCAST');
		// 		// msg was broadcasted
		// 	})

		// })

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

		let throttledIPFS = new ThrottledIPFS({
			ipfs: ipfs,
			logger: this.logger
		});

		let pinner = new Pinner({
			ipfs: ipfs,
			throttledIPFS : throttledIPFS,
			logger: this.logger
		});


		let ownershiptracker = new OwnershipTracker();

		contract.methods.persistLimit().call((err, res) => {
			if (err) {
				this.logger.error('cannot read contract %s : %s. Exiting',
					this.options.CONTRACTADDRESS, err.message);
				process.exit();
			}

			localData.sizelimit = new web3.utils.BN(res);
			this.logger.info('sizelimit= %d bytes', localData.sizelimit.toNumber(10));

			pinner.setLimit(localData.sizelimit);

			// TODO : move this to plugin method..
			if (this.plugins.peepeth) {
				addWatch({
					type: 'peepeth',
				});
			}
			// the watcher on the IPFS consortium contract
			contract.events.allEvents({
				fromBlock: this.options.STARTBLOCK,
			}, (error, result) => {
				if (error == null) {
					// for accounting purposes
					if (result.blockNumber > this.lastblock){
						this.lastblock = result.blockNumber;
					}
					web3.eth.getTransaction(result.transactionHash).then((transaction) => {
						switch (result.event) {
							case 'ContractAdded':
								this.logger.info('ContractAdded address=%s, startBlock=%d, member=%s',
									result.returnValues.pubKey,
									result.returnValues.startBlock,
									transaction.from);
								const contractAddress = cleanAddress(result.returnValues.pubKey);
								if (contractAddress !== this.options.CONTRACTADDRESS) {
									ownershiptracker.setOwner(contractAddress, transaction.from);
								}
								addWatch({
									type: 'ipfsconsortium',
									contractAddress: contractAddress,
									startBlock: result.returnValues.startBlock
								});

								break;
							case 'MetadataObjectAdded':
								this.logger.info('MetadataContractAdded hash=%s',
									result.returnValues.hash);
								addWatch({
									type: 'ipfsconsortiumobject',
									hash: result.returnValues.hash,
									transaction: transaction,
								});
								metadataContractAdded(transaction.from, result.returnValues.hash);
								break;
								// case 'ContractRemoved':
								// 	this.logger.info('ContractRemoved member=%s address=%s',
								// 		result.returnValues.member,
								// 		result.returnValues.pubKey);
								// 	removeContract(result.returnValues.pubKey, result.returnValues.member);
								// 	break;
								// case 'MemberAdded':
								// 	this.logger.info('MemberAdded pubkey=%s',
								// 		result.returnValues.newMember);
								// 	addMember(result.returnValues.newMember);
								// 	break;
								// case 'Banned':
								// case 'BanAttempt':
								// 	this.logger.warn('Event handler not implemented: %s', result.event);
								// 	break;
							case 'PersistLimitChanged':
								this.logger.info('Changing PersistLimit to %s bytes per member',
									result.returnValues.limit);
								pinner.setLimit(new web3.utils.BN(result.returnValues.limit));
								break;
							case 'MemberAdded':
							case 'HashAdded':
							case 'HashRemoved':
							case 'MemberRemoved':
								// the contract listener will catch these, We can ignore these here.
								break;
								// case 'MemberRemoved':
								// 	this.logger.info('MemberRemoved pubkey=%s',
								// 		result.returnValues.oldMember);
								// 	removeMember(result.returnValues.oldMember);
								// 	break;
							case 'Confirmation':
								break;
							default:
								this.logger.warn('unknown Event: %s', JSON.stringify(result));
								break;
						}
					}).catch((e)=>{
						debugger;
					});
				} else {
					this.logger.error('Error: %s', error.message);
				}
			});
		});



		// watchers
		//let watchers = {};
		let addWatch = (options) => {
			this.logger.info('Adding an event listener type %s - options %j', options.type, options);

			if (this.plugins[options.type]) {
				options.web3 = web3;
				options.logger = this.logger;
				options.pinner = pinner;
				options.ownershiptracker = ownershiptracker;
				options.contractAddress = cleanAddress(options.contractAddress);
				options.ipfs = ipfs;
				options.throttledIPFS = throttledIPFS;
				this.plugins[options.type].addWatch(options);
			} else {
				this.logger.info('no such plugin %s', options.type);
			}
		}

		let cleanAddress = (address) => {
			if (!address) return;
			return address.toLowerCase();
		};

		let metadataContractAdded = (member, metadataHash) => {

			// Obtaining contract metadata info
			ThrottledIPFS.cat(metadataHash).then((file) => {
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
					ThrottledIPFS.pin(metadataHash, (err, res) => {
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
							removeHash(result.returnValues[event.ipfsParam], contractMetadata.contract);
							// events of type 'HashWithIndex' allow to maintain an index of hashes based on a defined key
						} else if (event.type == 'HashWithIndex') {
							let index = result.returnValues[event.indexKey];
							// it gets the old hash, if it exists it'll be replaced by the new one
							let oldHash = localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractMetadata.contract))].index[index];
							if (oldHash) {
								removeHash(oldHash, contractMetadata.contract);
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
				removeHash(hash, contractaddress);
			});

			delete localData.memberInfo[cleanAddress(member)].contracts[(cleanAddress(contractaddress))];
		};

		let removeHash = (IPFShash, hashOwner = '') => {
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
					let pluginStats = {};
					for (let i=0;i<Object.keys(this.plugins).length;i++){
						pluginStats[Object.keys(this.plugins)[i]] = 
						this.plugins[Object.keys(this.plugins)[i]].getStats();
					}

					this.logger.info('state %s', JSON.stringify({
						currentBlock : blockNumber,
						lastProcessedBlock : this.lastblock,
						pinning: pinner.getAccountingStats(),
						ownership: ownershiptracker.getOwnerStats(),
						throttledIPFS : throttledIPFS.getStats(),
						plugins: pluginStats,
					}, true, 2));
				}).catch((e)=>{

				});
		};

		// let cleanepoch = () => {
		// 	dumpstate();
		// 	let now = Date.now();
		// 	let currentEpoch = timestamptoepoch(now);
		// 	this.logger.info('current epoch is %d', currentEpoch);
		// 	if (localData.epochtohash[currentEpoch]) {
		// 		for (let hash in localData.epochtohash[currentEpoch]) {
		// 			if (localData.epochtohash[currentEpoch].hasOwnProperty(hash)) {
		// 				if (localData.hashexpiry[hash] && localData.hashexpiry[hash] < now) {
		// 					removeHash(hash);
		// 				}
		// 			}
		// 		}
		// 	}
		// };

		// clean the hashtaglist every hour.
		//setInterval(cleanepoch, 1000 * 60 * 60);
		setInterval(dumpstate, 1000 * 10);
	}
}
module.exports = IPFSConsortiumProxy;
