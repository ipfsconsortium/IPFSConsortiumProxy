'use strict'
exports.definitions = [
  {
    name: 'ipfsapi',
    type: String,
    description: 'the API for your local IPFS server. for example:\'/ip4/127.0.0.1/tcp/5001\''
  },
  {
    name: 'contracts',
    type: String,
    multiple: true,
    description: "One or more contracts to listen to in the format <ws://localhost:8546|0x7433c7c768be4025ab791fb7b2942c3d9e309f3e>"
  },
  {
    name: 'help',
    type: Boolean,
    alias: 'h',
    description: "Show usage",
  }
]

exports.usageSections = [
  {
    header: 'ipfsconsortiumproxy',
    content: 'IPFS pinning/unpinning daemon'
  },
  {
    header: 'Synopsis',
    content: '$ ipfsconsortiumproxy'
  },
  {
    header: 'Options',
    optionList: exports.definitions
  }
]
