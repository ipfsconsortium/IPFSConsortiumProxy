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

		ens.getContent(options.web3, 'consortium.dappnode.eth', 'consortium').then(([consortiumConfigHash, owner]) => {
			options.throttledIPFS.cat(toIPFSHash(consortiumConfigHash)).then((file) => {
				const consortiumConfig = JSON.parse(file.toString());
				logger.info('Read consortium config : %j', consortiumConfig);

				ipfsconsortiumdata.validate(consortiumConfig)
					.then(() => {
						consortiumConfig.members.forEach((item) => {
							logger.info('New member => ENS entry found in config : %s', item.ensname);
							let pinner = new Pinner(item.ensname,
								new options.web3.utils.BN(item.quotum), options.throttledIPFS);

							this.pinners.push(pinner);
							pinner.pin(toIPFSHash(consortiumConfigHash));
							ens.getContent(options.web3, item.ensname, 'consortiumManifest').then(([consortiumManifestHash, owner]) => {
								logger.info('ENS %s resolved to %j', item.ensname, consortiumManifestHash);

								options.throttledIPFS.cat(toIPFSHash(consortiumManifestHash)).then((file) => {
									const s = JSON.parse(file.toString());
									logger.info('file %j', s);

									ipfsconsortiumdata.validate(s)
										.then(() => {
											pinner.pin(toIPFSHash(consortiumManifestHash));
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
					})
					.catch((e) => {
						logger.error('The ENS config is invalid %j', e);
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
		return (this.pinners.map((pinner) => pinner.getStats()));
	}
}

module.exports = ENSReader;
