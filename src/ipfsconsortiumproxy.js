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
			'ensreader': new(require('./plugins/ensreader'))(),
			//'ipfsconsortiumobject': new (require('./plugins/ipfsconsortiumobject'))(),
		};

		this.logger.info('options %j %s ', this.options, typeof this.options.PLUGINS);

		// // load additional plugins provided on the command line.
		// if (this.options.PLUGINS) {
		// 	this.options.PLUGINS.forEach((name) => {
		// 		this.logger.info('loading plugin %s', name);
		// 		const plugin = require('./plugins/' + name);
		// 		this.plugins[name] = new plugin();
		// 	});
		// }

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

		const web3 = new Web3(new Web3.providers.WebsocketProvider(this.options.WEB3HOSTWS));
		setInterval(function() {
			web3.eth.net.isListening().then().catch((e) => {
				//console.log('[ - ] Lost connection to the node: '+ WEB3HOSTWS +', reconnecting');
				web3.setProvider(this.options.WEB3HOSTWS);
			})
		}, 10000);

		let throttledIPFS = new ThrottledIPFS({
			ipfs: ipfs,
			logger: this.logger
		});

		let pinner = new Pinner({
			ipfs: ipfs,
			throttledIPFS: throttledIPFS,
			logger: this.logger
		});

		let ownershiptracker = new OwnershipTracker();

		let addWatch = (options) => {
			this.logger.info('Adding an event listener type %s - options %j', options.type, options);

			if (this.plugins[options.type]) {
				options.web3 = web3;
				options.logger = this.logger;
				options.pinner = pinner;
				options.ownershiptracker = ownershiptracker;
				options.ipfs = ipfs;
				options.throttledIPFS = throttledIPFS;
				this.plugins[options.type].addWatch(options);
			} else {
				this.logger.info('no such plugin %s', options.type);
			}
		}

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

					this.logger.info('state %s', JSON.stringify({
						currentBlock: blockNumber,
						lastProcessedBlock: this.lastblock,
						pinning: pinner.getAccountingStats(),
						ownership: ownershiptracker.getOwnerStats(),
						throttledIPFS: throttledIPFS.getStats(),
						plugins: pluginStats,
					}, true, 2));
				}).catch((e) => {

				});
		};

		setInterval(dumpstate, 1000 * 10);
	}
}
module.exports = IPFSConsortiumProxy;
