'use strict';

exports.definitions = [{
	name: 'ipfsapihost',
	type: String,
	description: 'the hostname of your local IPFS server API. for example:\'127.0.0.1\'',
}, {
	name: 'ipfsapiport',
	type: Number,
	description: 'the port of your local IPFS server API. ex. 5001',
}, {
	name: 'web3hostws',
	type: String,
	description: 'the URL of your local Ethereum node WS. ex. "ws://localhost:8546"',
}, {
	name: 'contractaddress',
	type: String,
	description: 'consortium contract address. ex. "0x7433c7c768be4025ab791fb7b2942c3d9e309f3e"',
}, {
	name: 'startblock',
	type: Number,
	description: 'the URL of your local Ethereum node WS. ex. 4090116',
}, {
	name: 'plugins',
	type: String,
	description: 'a list of extra plugins to enable',
	multiple: true,
}, {
	name: 'help',
	type: Boolean,
	alias: 'h',
	description: 'Show usage',
}, ];

exports.usageSections = [{
	header: 'ipfsconsortiumproxy',
	content: 'IPFS pinning/unpinning daemon',
}, {
	header: 'Synopsis',
	content: '$ ipfsconsortiumproxy <options>',
}, {
	header: 'Options',
	optionList: exports.definitions,
}, ];
