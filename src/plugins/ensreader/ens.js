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

exports.getContent = (web3, name, key) => {
	const node = namehash(web3, name);
	let ens = new web3.eth.Contract(ensAbi, ensAddr);
	return ens.methods.resolver(node).call().then((resolverAddress) => {
		if (resolverAddress === '0x0000000000000000000000000000000000000000') {
			return Promise.reject();
		}
		const resolver = new web3.eth.Contract(resolverAbi, resolverAddress);
		return Promise.all([
			resolver.methods.text(node, key).call(),
			ens.methods.owner(node).call(),
		]);
	});
};
