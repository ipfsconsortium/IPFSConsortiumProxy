const ensAbi = require('./abi/ensAbi.json');
const ensAddr = '0x314159265dd8dbb310642f98f50c066173c1259b';
const resolverAbi = require('./abi/resolverAbi.json');

/**
 * calculates the hash of a name
 *
 * @param      {Object}  web3    a configured web3 object
 * @param      {string}  name    The name to resolve
 * @return     {string}  { hashed name }
 */
function namehash(web3, name) {
	let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
	if (name != '') {
		let labels = name.split('.');
		for (let i = labels.length - 1; i >= 0; i--) {
			node = web3.utils.sha3(node + web3.utils.sha3(labels[i]).slice(2), {
				encoding: 'hex',
			});
		}
	}
	return node.toString();
}

/**
 * Returns the text record associated with the given ENS name + key
 *
 * @param      {object}  web3    An initiated web3 (1.0) object
 * @param      {string}  name    The ENS name
 * @param      {string}  key     key to fetch text entry from
 * @return     {Promise}  resolves when data available
 */
exports.getContent = (web3, name, key) => {
	const node = namehash(web3, name);
	let ens = new web3.eth.Contract(ensAbi, ensAddr);
	return ens.methods.resolver(node).call().then((resolverAddress) => {
		if (resolverAddress === '0x0000000000000000000000000000000000000000') {
			return Promise.reject(new Error('resolver address is not set for ' + name));
		}
		const resolver = new web3.eth.Contract(resolverAbi, resolverAddress);
		return Promise.all([
			resolver.methods.text(node, key).call(),
			ens.methods.owner(node).call(),
		]);
	});
};
