const ensconfig = require('../../../ensconfig.json');
const ens = require('./ens');
const ipfsconsortiumdata = require('ipfsconsortiumdata');

/**
 * Class for ens reader.
 *
 * @class      ENSReader
 */
class ENSReader {
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

		options.logger.info('ENS reader started');
		ensconfig.forEach((item) => {
			options.logger.info('ENS entry found in config : %s', item);
			ens.getContent(options.web3, item, 'consortiumManifest').then(([content, owner]) => {
				options.logger.info('ENS %s resolved to %j', item, content);
				options.logger.info('ENS %s owner is %j', item, owner);

				options.throttledIPFS.cat(toIPFSHash(content)).then((file) => {
					const s = JSON.parse(file.toString('utf-8'));
					options.logger.info('file %j',s); 
					debugger;
					ipfsconsortiumdata.validate(s)
						.then(() => {
							options.pinner.setLimit(new options.web3.utils.BN(s.quotum));
							options.pinner.pin(owner, toIPFSHash(content));
							s.pin.forEach((pinItem) => {
								options.pinner.pin(owner, toIPFSHash(pinItem));
							});
						})
						.catch((e) => {
							options.logger.error('The ENS data is invalid %j', e);
						});
				}).catch((e) => {
					options.logger.error('Cannot read IPFS data %s', e);
				});
			}).catch((e) => {
				options.logger.error('Failed to resolve %s: %s', item, e);
			});
		});
	}

	/**
	 * Return usage stats
	 *
	 * @return     {String}  The statistics.
	 */
	getStats() {
		return ({});
	}
}

module.exports = ENSReader;
