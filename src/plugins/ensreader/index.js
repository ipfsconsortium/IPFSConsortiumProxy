const ensconfig = require('../../../ensconfig.json');
const ens = require('./ens');

const ENS = require('ethereum-ens');



/*
 * ENSReader plugin
 */
class ENSReader {
	addWatch(options) {

		const toIPFSHash = (input) => {
			if (!input) {
				return;
			}
			return input.replace('/ipfs/', '');
		}

		//const owner = "0xa3dad2e20e48317a8bd004561cea26cc8c2d09cd";

		options.logger.info('ENS reader started');
		ensconfig.forEach((item) => {
			options.logger.info('ENS entry found in config : %s', item);
			ens.getContent(options.web3, item, 'consortiumManifest').then(([content,owner]) => {
				options.logger.info('ENS %s resolved to %j', item, content);
				options.logger.info('ENS %s owner is %j', item, owner);

				options.pinner.pin(owner, toIPFSHash(content));
				options.throttledIPFS.cat(toIPFSHash(content)).then((file) => {
					const s = JSON.parse(file.toString());
					options.pinner.setLimit(new options.web3.utils.BN(s.quota));
					s.pin.forEach((pinItem) => {
						options.pinner.pin(owner, toIPFSHash(pinItem));
					});
				});


			});
		});



		// const contract = new options.web3.eth.Contract(IPFSProxy.abi, options.contractAddress);

		// contract.events.allEvents({
		// 	fromBlock: options.startBlock,
		// }, (error, result) => {
		// 	if (error == null) {
		// 		options.web3.eth.getTransaction(result.transactionHash).then((transaction) => {
		// 			switch (result.event) {
		// 				case 'HashAdded':
		// 					resolveExpiration(transaction.blockNumber, result.returnValues.ttl).then((expiryTimeStamp) => {
		// 						if (expiryTimeStamp >= 0) {
		// 							options.pinner.pin(options.ownershiptracker.getOwner(options.contractAddress) || transaction.from, result.returnValues.hash, result.returnValues.ttl);
		// 						} else {
		// 							options.logger.info('hash %s already expired. Not pinning', result.returnValues.hash);
		// 						}
		// 					});
		// 					break;
		// 				case 'HashRemoved':
		// 					options.pinner.unpin(options.ownershiptracker.getOwner(options.contractAddress) || transaction.from, result.returnValues.hash);
		// 					break;
		// 			}
		// 		});
		// 	} else {
		// 		options.logger.error('Error reading event: %s', error.message);
		// 	}
		// });

		// function resolveExpiration(blockNumber, ttl){
		// 	return new Promise((resolve, reject) => {
		// 		ttl = parseInt(ttl);
		// 		if (ttl === 0) {
		// 			return resolve(0);
		// 		}
		// 		options.web3.eth.getBlock(blockNumber).then((blockInfo) => {
		// 			const expiryTimeStamp =
		// 				ttl +
		// 				blockInfo.timestamp * 1000;
		// 			return resolve(expiryTimeStamp);
		// 		});
		// 	});
		// }		
	}

	getStats() {
		return ({});
	}
}

module.exports = ENSReader;
