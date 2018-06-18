'use strict';
/* eslint no-console: ["error", { allow: ["warn", "error","log"] }] */
/* eslint max-len: ["error", { "code": 280 }] */
const logger = require('./logs')(module);

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

		this.options = options;

		this.plugins = {
			'ensreader': new(require('./plugins/ensreader'))(),
		};

		logger.info('options %j %s', this.options, typeof this.options.PLUGINS);
		logger.info('plugins loaded: %j', Object.keys(this.plugins));
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
			timeout: 1000 * 60,
		});

		const web3 = new Web3(new Web3.providers.WebsocketProvider(this.options.WEB3HOSTWS));

		// check connectivity to Web3 socket, reconnect if neccesary
		setInterval(() => {
			web3.eth.net.isListening().then().catch((e) => {
				web3.setProvider(this.options.WEB3HOSTWS);
			});
		}, 10 * 1000);

		let throttledIPFS = new ThrottledIPFS({
			ipfs: ipfs,
			logger: this.logger,
		});

		// let pinner = new Pinner({
		// 	ipfs: ipfs,
		// 	throttledIPFS: throttledIPFS,
		// 	logger: this.logger,
		// });

		let ownershiptracker = new OwnershipTracker();

		let addWatch = (options) => {
			logger.info('Adding an event listener type %s - options %j', options.type, options);

			if (this.plugins[options.type]) {
				options.web3 = web3;
				options.logger = this.logger;
				//options.pinner = pinner;
				options.ownershiptracker = ownershiptracker;
				options.ipfs = ipfs;
				options.throttledIPFS = throttledIPFS;
				this.plugins[options.type].addWatch(options);
			} else {
				logger.info('no such plugin %s', options.type);
			}
		};

		addWatch({
			type: 'ensreader',
		});

		let dumpstate = () => {
			web3.eth.getBlockNumber()
				.then((blockNumber) => {
					let pluginStats = {};
					for (let i = 0; i < Object.keys(this.plugins).length; i++) {
						pluginStats[Object.keys(this.plugins)[i]] =
							this.plugins[Object.keys(this.plugins)[i]].getStats();
					}

					logger.info('state %s', JSON.stringify({
						currentBlock: blockNumber,
						lastProcessedBlock: this.lastblock,
						//pinning: pinner.getAccountingStats(),
						ownership: ownershiptracker.getOwnerStats(),
						throttledIPFS: throttledIPFS.getStats(),
						plugins: pluginStats,
					}, true, 2));
				}).catch((e) => {
					logger.info('Error %j', e);
				});
		};

		setInterval(dumpstate, 1000 * 10);
	}
}

module.exports = IPFSConsortiumProxy;
