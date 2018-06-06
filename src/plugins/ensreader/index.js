const ensconfig = require('../../../ensconfig.json');
const ens = require('./ens');

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
