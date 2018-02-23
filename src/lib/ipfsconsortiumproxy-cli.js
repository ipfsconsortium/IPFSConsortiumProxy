'use strict'

class IPFSConsortiumProxyCli {
	constructor(options) {
		options = options || {}

		this.stdout = options.stdout || process.stdout
		this.stdin = require('stream').PassThrough()

	}

	go(argv) {

		const tool = require('command-line-tool');
		const cliData = require('./cli-data');
		const IPFSConsortiumProxy = require('../ipfsconsortiumproxy.js');

		const cli = tool.getCli(cliData.definitions, cliData.usageSections, argv)
		const options = cli.options

		if (options.help) {
			const os = require('os')
			this.stdout.write(cli.usage + os.EOL)
			this.stdin.end()
			return
		}

		function startProxy() {
			const proxy = new IPFSConsortiumProxy();
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
