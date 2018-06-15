const consortium = require('../../../consortium.json');
const ens = require('./ens');
const ipfsconsortiumdata = require('ipfsconsortiumdata');
const logger = require('../../logs')(module);
const Pinner = require('../../Pinner');

/**
 * Class for ens reader.
 *
 * @class      ENSReader
 */
class ENSReader {
	constructor() {
		this.pinners = [];
	}
	/**
	 * Adds a watch to the ENS config
	 *
	 * @param      {Object}  options  The options received from the main proxy client
	 */
	addWatch(options) {
		const toIPFSHash = (input) => {
			if (!input) {
				return;
			}
			return input.replace('/ipfs/', '');
		};

		logger.info('ENS reader started');
		consortium.members.forEach((item) => {
			logger.info('New member => ENS entry found in config : %s', item.ensname);
			let pinner = new Pinner(item.ensname,new options.web3.utils.BN(item.quotum),options.throttledIPFS);
			// {
			// 	name: item.ensname,
			// 	ipfs: options.ipfs,
			// 	throttledIPFS: options.throttledIPFS,
			// });
			this.pinners.push(pinner);
			pinner.setLimit(new options.web3.utils.BN(item.quotum));
			ens.getContent(options.web3, item.ensname, 'consortiumManifest').then(([content, owner]) => {
				logger.info('ENS %s resolved to %j', item.ensname, content);

				options.throttledIPFS.cat(toIPFSHash(content)).then((file) => {
					const s = JSON.parse(file.toString());
					logger.info('file %j', s);

					ipfsconsortiumdata.validate(s)
						.then(() => {
							//options.pinner.setLimit(new options.web3.utils.BN(s.quotum));
							pinner.pin(toIPFSHash(content));
							s.pin.forEach((pinItem) => {
								pinner.pin(toIPFSHash(pinItem));
							});
						})
						.catch((e) => {
							logger.error('The ENS data is invalid %j', e);
						});
				}).catch((e) => {
					logger.error('Cannot read IPFS data %s', e);
				});
			}).catch((e) => {
				logger.error('Failed to resolve %s: %s', item.ensname, e);
			});
		});
	}

	/**
	 * Return usage stats
	 *
	 * @return     {String}  The statistics.
	 */
	getStats() {
		return ([this.pinners.map((pinner) => {
			return ({
				name: pinner.name,
				usage: pinner.getUsage.toNumber(10),
			});
		})]);
	}
}

module.exports = ENSReader;
