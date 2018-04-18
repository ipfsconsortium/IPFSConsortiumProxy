const metaData = require('./metadata');
const abiDecoder = require('abi-decoder');


module.exports = {
	addWatch: (options) => {
		options.logger.info('addWatch starting Peepeth %s ( from block %s)', metaData.contract, metaData.startblock);
		const contract = new options.web3.eth.Contract(metaData.abi, metaData.contract);
		const defaultTtl = 60 * 60 * 24 * 365 * 10; // 10 years
		abiDecoder.addABI(metaData.abi);
		let eventCount = 1;

		contract.events.allEvents({
			fromBlock: metaData.startblock,
		}, (error, result) => {
			if (error == null) {
				options.web3.eth.getTransaction(result.transactionHash).then((transaction) => {

					const decodedData = abiDecoder.decodeMethod(transaction.input);
					eventCount++;

					switch (decodedData.name) {
						case 'createAccount':
						case 'updateAccount':
						case 'tip':
							var found = decodedData.params.find(function(element) {
								return element.name === '_ipfsHash';
							});
							options.logger.info('createAccount. IPFS=%s', found.value);
							options.pinner.pin(metaData.contract, found.value, defaultTtl);
							break;
						case 'post':
						case 'reply':
							var found = decodedData.params.find(function(element) {
								return element.name === '_ipfsHash';
							});
							parsePeep(found.value);
							break;
						case 'saveBatch':
							var found = decodedData.params.find(function(element) {
								return element.name === '_ipfsHash';
							});
							options.ipfs.cat(found.value).then((file) => {
								const s = JSON.parse(file.toString());
								if (s.batchSaveJSON && Array.isArray(s.batchSaveJSON)) {
									s.batchSaveJSON.forEach((batchItem) => {
										const command = Object.keys(batchItem)[0];
										switch (command) {
											case 'follow':
											case 'unfollow':
											case 'changeName':
												break;
											case 'peep':
												if (batchItem[command].ipfs) {
													parsePeep(batchItem[command].ipfs);
												}
												break;
											case 'love':
												if (batchItem[command].messageID) {
													parsePeep(batchItem[command].messageID);
												}
												break;
											default:
												options.logger.warn('unknown function %s %j', command, batchItem);
												process.exit();
												break;
										}
									});
								}
							});
						case 'share':
							var found = decodedData.params.find(function(element) {
								return element.name === '_ipfsHash';
							});
							options.pinner.pin(metaData.contract, found.value, defaultTtl);
							options.ipfs.cat(found.value).then((file) => {
								const s = JSON.parse(file.toString());
								if (s.pic && s.pic != "") {
									options.pinner.pin(metaData.contract, s.pic, defaultTtl);
								}
								if (s.shareID && s.shareID != "") {
									options.pinner.pin(metaData.contract, s.pic, defaultTtl);
								}

							});
							break;
						case 'love':
							var found = decodedData.params.find(function(element) {
								return element.name === 'messageID';
							});
							options.pinner.pin(metaData.contract, found.value, defaultTtl);
							break;
						case 'follow':
						case 'unfollow':
						case 'changeName':
							// no IPFS involved here..
							break;
						default:
							options.logger.warn('unknown function %s (%j)', decodedData.name, decodedData);
							process.exit();
							break;
					}
				});
			} else {
				this.logger.error('Error reading event: %s', error.message);
			}
		});

		function parsePeep(ipfsHash) {
			options.pinner.pin(metaData.contract, ipfsHash, defaultTtl);
			options.ipfs.cat(ipfsHash).then((file) => {
				const s = JSON.parse(file.toString());
				if (s.pic && s.pic != "") {
					options.pinner.pin(metaData.contract, s.pic, defaultTtl);
				}
			});
		}


	}
}
