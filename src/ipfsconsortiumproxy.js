'use strict';

class IPFSConsortiumProxy {
	constructor(options) {}

	go() {

		// mixin the environment variables defined in .env
		require('dotenv').config({
			path: '.env',
		});

		let Web3 = require('web3');
		let ipfsAPI = require('ipfs-api');

		let ipfs = ipfsAPI({
			host: process.env.IPFSAPIHOST,
			port: process.env.IPFSAPIPORT,
			protocol: 'http',
		});

		let IPFSProxy = require('../node_modules/ipfsconsortiumcontracts/build/contracts/IPFSProxy.json');
		let IPFSEvents = require('../node_modules/ipfsconsortiumcontracts/build/contracts/IPFSEvents.json');

		let web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3HOSTWS));

		let contract = new web3.eth.Contract(IPFSProxy.abi, process.env.CONTRACTADDRESS);

		let memberquota = {};
		let hashvalidity = {};
		let epochtohash = {};
		let watchedcontracts = {};

		contract.methods.sizeLimit().call(function(err, res) {
			if (err) {
				process.exit();
			}
			var sizelimit = new web3.utils.BN(res);
			console.log('sizelimit=', sizelimit.toNumber(10));

			contract.events.allEvents({
				fromBlock: process.env.STARTBLOCK
			}, function(error, result) {
				if (error == null) {
					switch (result.event) {
						case 'ContractAdded':
							console.log('ContractAdded', result.returnValues.pubKey, result.returnValues.ttl);
							addContract(result.returnValues.pubKey, result.blockNumber);
							break;
						case 'MemberAdded':
							console.log('MemberAdded', result.returnValues.newMember);
							memberquota[result.returnValues.newMember] = {
								totalsize: 0
							};
							break;
						case 'Banned':
						case 'BanAttempt':
							console.log('Event handler not implemented:', result.event);
							break;
						default:
							console.log('unknown Event:', result.event);
							break;
					}
				} else {
					console.log(error, result);
				}
			});
		});

		function addContract(contractaddress, startblock) {
			if (watchedcontracts[contractaddress]) {
				console.log('already watching address', contractaddress);
				return;
			}
			//  var contract = web3.eth.contract(config.IPFSEventsAbi).at(contractaddress);
			let contract = new web3.eth.Contract(IPFSEvents.abi, contractaddress);

			// var eventlistener = contract.allEvents({
			// 	fromBlock: startblock,
			// 	toBlock: 'latest'
			// });

			let listener = contract.events.allEvents({
				fromBlock: startblock
			}, function(error, result) {
				if (error == null) {
					switch (result.event) {
						case 'HashAdded':
							web3.eth.getBlock(result.blockNumber, function(error, blockInfo) {
								console.log('block timestamp approx=', blockInfo.timestamp);

								var remainingTTL = parseInt(result.returnValues.ttl) + blockInfo.timestamp * 1000;
								console.log('remaining TTL', remainingTTL);

								if (remainingTTL < 0) {
									console.log('already expired - not adding to pinned list');
								} else {
									// TODO : get size of file on this hash
									// TODO : totalsize of member
									// TODO : if totalsize + filesize > memberquota[member] -> ban user
									// TODO : else, increase totalsize 

									console.log('pinning hash', result.returnValues.hashAdded);

									ipfs.pin.add(result.returnValues.hashAdded, function(err, res) {
										console.log('pinned...', result.returnValues.hashAdded, err, res);
										addexpiration(result.returnValues.hashAdded, remainingTTL);
									});
								}
							});
							break;
						case 'HashRemoved':
							removehash(result.returnValues.hashAdded);
							break;
					}
				} else {
					console.log(error, result);
				}
			});

			watchedcontracts[contractaddress] = listener;

		}


		// clean the hashtaglist every hour.
		setInterval(cleanepoch, 1000 * 60 * 60);

		function addexpiration(ipfshash, expiretimestamp) {
			var epoch = timestamptoepoch(expiretimestamp);
			//  is this ipfshash unknown or is this the latest expiry of an existing ipfshash ?
			if (!hashvalidity[ipfshash] || hashvalidity[ipfshash] < expiretimestamp) {

				// remove old epoch if it exists
				var oldepoch = timestamptoepoch(hashvalidity[ipfshash]);
				if (epochtohash[oldepoch] && epochtohash[oldepoch][ipfshash]) {
					delete epochtohash[oldepoch][ipfshash];
				}

				// mark latest expiration date
				hashvalidity[ipfshash] = expiretimestamp;

				// and flag this hash in it's epoch, to make removal easier.
				if (!epochtohash[epoch]) {
					epochtohash[epoch] = {};
				}
				epochtohash[epoch][ipfshash] = true;
			}
		}

		function cleanepoch() {
			var now = Date.now();
			var currentEpoch = timestamptoepoch(now);
			console.log('current epoch is', currentEpoch);
			if (epochtohash[currentEpoch]) {
				for (var hash in epochtohash[currentEpoch]) {
					if (epochtohash[currentEpoch].hasOwnProperty(hash)) {
						console.log('in epoch:', hash);
						if (hashvalidity[hash] && hashvalidity[hash] < now) {
							removehash(hash);
						}
					}
				}
			}
		}

		function removehash(ipfshash) {
			if (!hashvalidity[hash]) return;
			console.log('removing', hash);
			var myEpoch = timestamptoepoch(hashvalidity[hash]);
			ipfs.pin.rm(ipfshash, function(err, res) {
				if (err && err.code === 0) {
					console.log('already unpinned');
				} else {
					console.log('unpinned...', res);
				}
			});
			if (epochtohash[myEpoch]) {
				delete epochtohash[myEpoch][hash];
			}
			delete hashvalidity[hash];
		}

		function timestamptoepoch(timestamp) {
			return Math.floor(timestamp / (1000 * 60 * 60));
		}
	}
}
module.exports = IPFSConsortiumProxy
