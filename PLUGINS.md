# Plugins

It is possible to write your own plugin for pinning content.


# Base structure

```
class myPlugin {
	addWatch(options) { 
	 // ...
	}
	getStats() {
	 // return an object with stats of your plugin 
	}
}
module.exports = myPlugin;

```

the function `addWatch` receives an `options` object containing following fields:

- `web3` : a web3 object that can be used to inspect the blockchain
- `logger` : a `winston` instance that can be used for logging
- `pinner` : a pinning object that can be used to pin / unpin IPFS hashes, taking the limits of the consortium into account. If you exceed your quota - it will stop pinning new data.
- `ipfs` : an `ipfs-api` object that allows you to talk to IPFS directly.
- `throttledipfs` : `ipfs-api` wrapped in a queue that throttles requests to the API.

# Adding and registering your plugin

Create a folder in the `src/plugins` directory and add an `index.js` file there with your module.

```
src/plugins/
src/plugins/myplugin
src/plugins/myplugin/index.js
```

Registering is done by adding it on the commandline `--enable-plugin=myplugin`



