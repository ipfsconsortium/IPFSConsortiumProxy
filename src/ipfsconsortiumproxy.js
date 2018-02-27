'use strict';


class IPFSConsortiumProxy {

	constructor(options) {
		const {
			createLogger,
			format,
			transports
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

	go() {

		let Web3 = require('web3');
		let ipfsAPI = require('ipfs-api');

		//this.logger.info('Hello again distributed logs',null);

		let ipfs = ipfsAPI({
			host: this.options.IPFSAPIHOST,
			port: this.options.IPFSAPIPORT,
			protocol: 'http',
		});

		let IPFSProxy = require('../node_modules/ipfsconsortiumcontracts/build/contracts/IPFSProxy.json');
		let IPFSEvents = require('../node_modules/ipfsconsortiumcontracts/build/contracts/IPFSEvents.json');

		let web3 = new Web3(new Web3.providers.WebsocketProvider(this.options.WEB3HOSTWS));

		let contract = new web3.eth.Contract(IPFSProxy.abi, this.options.CONTRACTADDRESS);

		let localData = {
			memberquota: {},
			hashexpiry: {},
			epochtohash: {},
			watchedcontracts: {},
			lastblock: this.options.STARTBLOCK,
			sizelimit: new web3.utils.BN(0),
		};

		contract.methods.sizeLimit().call((err, res) => {
			if (err) {
				process.exit();
			}
			localData.sizelimit = new web3.utils.BN(res);
			this.logger.info('sizelimit= %d bytes', localData.sizelimit.toNumber(10));

			contract.events.allEvents({
				fromBlock: this.options.STARTBLOCK
			}, (error, result) => {
				if (error == null) {
					switch (result.event) {
						case 'ContractAdded':
							this.logger.info('ContractAdded address=%s, ttl=%s', result.returnValues.pubKey, result.returnValues.ttl);
							addContract(result.returnValues.pubKey, result.blockNumber);
							break;
						case 'MemberAdded':
							this.logger.info('MemberAdded pubkey=%s', result.returnValues.newMember);
							addMember(result.returnValues.newMember);
							break;
						case 'Banned':
						case 'BanAttempt':
							this.logger.warn('Event handler not implemented: %s', result.event);
							break;
						case 'PersistLimitChanged':
							this.logger.info('Changing PersistLimit to %s bytes per member', result.returnValues.limit);
							localData.sizelimit = new web3.utils.BN(result.returnValues.limit);
							break;
						case 'HashAdded':
						case 'HashRemoved':
							// the contract listener will catch these, We can ignore these here.
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
		}

		let isMember = (address) => {
			return (localData.memberquota[cleanAddress(address)] != null);
		}

		let addMember = (address) => {
			if (!isMember(address)) {
				localData.memberquota[cleanAddress(address)] = {
					used: new web3.utils.BN(0),
				};
			}
		}

		let getMemberQuota = (address) => {
			return localData.memberquota[cleanAddress(address)] ? localData.memberquota[cleanAddress(address)].used : new web3.utils.BN(0);
		}

		let canAddToQuota = (address, amount) => {
			return (localData.memberquota[cleanAddress(address)].used.add(amount).cmp(localData.sizelimit) === -1);
		}


		let addToQuota = (address, amount) => {
			localData.memberquota[cleanAddress(address)].used = localData.memberquota[cleanAddress(address)].used.add(amount);
		}

		let subtractFromQuota = (address, amount) => {
			localData.memberquota[cleanAddress(address)].used = localData.memberquota[cleanAddress(address)].used.sub(amount);
		}

		let addHash = (IPFShash, memberAddress, expiryTimeStamp) => {
			// TODO : get size of file on this hash
			ipfs.cat(IPFShash).then((r) => {
				this.logger.info('hash fetched %d bytes', r.byteLength);
				let hashByteSize = new web3.utils.BN(r.byteLength);
				// TODO : totalsize of member
				// TODO : if totalsize + filesize > localData.memberquota[member] -> ban user
				if (canAddToQuota(cleanAddress(memberAddress), hashByteSize)) {

					this.logger.info('pinning hash %s until %s', IPFShash, new Date(expiryTimeStamp));

					ipfs.pin.add(IPFShash, (err, res) => {
						if (!err) {
							this.logger.info('pinning complete... %s', JSON.stringify(res));
							addexpiration(IPFShash, expiryTimeStamp);
							addToQuota(cleanAddress(memberAddress), hashByteSize);
							dumpstate();
						} else {
							this.logger.error('Error pinning hash %s', err.message);
						}
					});
				} else {
					this.logger.error('Pinning hash %s would exceed users %s quota => ignoring', IPFShash, memberAddress);
				}


			}).catch((err) => {
				this.logger.error(err.message);
			});

		}

		let addContract = (contractaddress, startblock) => {
			if (localData.watchedcontracts[cleanAddress(contractaddress)]) {
				this.logger.info('already watching address %s', contractaddress);
				return;
			}
			let contract = new web3.eth.Contract(IPFSEvents.abi, contractaddress);

			let listener = contract.events.allEvents({
				fromBlock: startblock
			}, (error, result) => {
				if (error == null) {
					switch (result.event) {
						case 'HashAdded':
							if (isMember(result.returnValues.pubKey)) {
								web3.eth.getBlock(result.blockNumber, (error, blockInfo) => {
									var expiryTimeStamp = parseInt(result.returnValues.ttl) + blockInfo.timestamp * 1000;

									if (result.returnValues.pubKey < Date().now) {
										this.logger.info('already expired - not adding to pinned list');
									} else {
										addHash(result.returnValues.hashAdded, result.returnValues.pubKey, expiryTimeStamp);
									}
								});
							} else {
								this.logger.warn('HashAdded %s is not a member of the consortium', result.returnValues.pubKey);
							}
							break;
						case 'HashRemoved':
							removehash(result.returnValues.hashAdded);
							break;
					}
				} else {
					this.logger.error('Error reading event: %s', error.message);
				}
			});
			localData.watchedcontracts[cleanAddress(contractaddress)] = listener;
		}

		let addexpiration = (ipfshash, expiretimestamp) => {
			var epoch = timestamptoepoch(expiretimestamp);
			//  is this ipfshash unknown or is this the latest expiry of an existing ipfshash ?
			if (!localData.hashexpiry[ipfshash] || localData.hashexpiry[ipfshash] < expiretimestamp) {

				// remove old epoch if it exists
				var oldepoch = timestamptoepoch(localData.hashexpiry[ipfshash]);
				if (localData.epochtohash[oldepoch] && localData.epochtohash[oldepoch][ipfshash]) {
					delete localData.epochtohash[oldepoch][ipfshash];
				}

				// mark latest expiration date
				localData.hashexpiry[ipfshash] = expiretimestamp;

				// and flag this hash in it's epoch, to make removal easier.
				if (!localData.epochtohash[epoch]) {
					localData.epochtohash[epoch] = {};
				}
				localData.epochtohash[epoch][ipfshash] = true;
			}
		}

		let cleanepoch = () => {
			var now = Date.now();
			var currentEpoch = timestamptoepoch(now);
			this.logger.info('current epoch is %d', currentEpoch);
			if (localData.epochtohash[currentEpoch]) {
				for (var hash in localData.epochtohash[currentEpoch]) {
					if (localData.epochtohash[currentEpoch].hasOwnProperty(hash)) {
						console.log('in epoch:', hash);
						if (localData.hashexpiry[hash] && localData.hashexpiry[hash] < now) {
							removehash(hash);
						}
					}
				}
			}
		}

		let removehash = (ipfshash) => {
			if (!localData.hashexpiry[hash]) return;
			this.logger.info('removing hash %s', hash);
			var myEpoch = timestamptoepoch(localData.hashexpiry[hash]);
			ipfs.pin.rm(ipfshash, (err, res) => {
				if (err && err.code === 0) {
					this.logger.warn('already unpinned hash %s', hash);
				} else {
					this.logger.info('unpinned hash %s', hash, res);
				}
			});
			if (localData.epochtohash[myEpoch]) {
				delete localData.epochtohash[myEpoch][hash];
			}
			delete localData.hashexpiry[hash];
		}

		let timestamptoepoch = (timestamp) => {
			return Math.floor(timestamp / (1000 * 60 * 60));
		}

		let dumpstate = () => {
			web3.eth.getBlockNumber()
				.then((blockNumber) => {
					this.logger.info('state %s', JSON.stringify({
						lastblock: localData.lastblock,
						hashexpiry: localData.hashexpiry,
						memberquota: localData.memberquota,
						contracts: Object.keys(localData.watchedcontracts),
					}, true, 2));
				});
		}

		// clean the hashtaglist every hour.
		setInterval(cleanepoch, 1000 * 60 * 60);
	}
}
module.exports = IPFSConsortiumProxy;
