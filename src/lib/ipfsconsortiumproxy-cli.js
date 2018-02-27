'use strict'

class IPFSConsortiumProxyCli {
	constructor(options) {
		options = options || {}

		this.stdout = options.stdout || process.stdout
		this.stdin = require('stream').PassThrough()

	}

	go(argv) {
		// mixin the environment variables defined in .env
		require('dotenv').config({
			path: '.env',
		});

		const tool = require('command-line-tool');
		const cliData = require('./cli-data');
		const IPFSConsortiumProxy = require('../ipfsconsortiumproxy.js');

		const cli = tool.getCli(cliData.definitions, cliData.usageSections, argv)
		const options = cli.options


		let proxyOptions = {
			IPFSAPIHOST: options.ipfsapihost || process.env.IPFSAPIHOST,
			IPFSAPIPORT: options.ipfsapiport || process.env.IPFSAPIPORT,
			WEB3HOSTWS: options.web3hostws || process.env.WEB3HOSTWS,
			CONTRACTADDRESS: options.contractaddress || process.env.CONTRACTADDRESS,
			STARTBLOCK: options.startblock || process.env.STARTBLOCK,
		};

		if (!proxyOptions.IPFSAPIHOST ||
			!proxyOptions.IPFSAPIPORT ||
			!proxyOptions.WEB3HOSTWS ||
			!proxyOptions.CONTRACTADDRESS ||
			!proxyOptions.STARTBLOCK
		) {
			options.help = true;
		}

		if (options.help) {
			const os = require('os');
			this.stdout.write(cli.usage + os.EOL);
			this.stdin.end();
			return;
		}

		function startProxy() {
			const proxy = new IPFSConsortiumProxy(proxyOptions);
			proxy.go();
		}

		startProxy();

		// this.stdin
		// .pipe(startProxy)
		// .on('error', tool.halt)
		// .pipe(this.stdout)
	}
}

module.exports = IPFSConsortiumProxyCli
