# IPFS Consortium proxy

This script watches a consortium proxy contract and pins/unpins IPFS data on your local
IPFS server according to the Events that flow through the monitored contracts.

## Configuration

Check / modify the settings in the enclosed .env file
You can override any of these values by setting an ENV value with the same name.

By default the IPFS API is assumed to be on `localhost` port `5001` using the HTTP protocol
The Ethereum node to connect to is `localhost` port `8546` using the websocket protocol

## Running

`npm install`
`npm start`

## How can I help

### Running an IPFS node

Setup a local IPFS node + Ethereum node , install the script and start listening to one or more IPFS consortium contracts

### Contributing to the development

We use ZenHub as a project management tool for this project.

- Install the ZenHub chrome plugin ( https://chrome.google.com/webstore/detail/zenhub-for-github/ogcgkffhplmphkaahpmffcafajaocjbd )
- visit the project board : https://github.com/ipfsconsortium/pm/issues/2#boards?repos=106814113
- check the `backlog` and `new issues` pipeline 

If you don't want to install this plugin , just check the issues on the project 

# Get in touch

- IPFSConsortium chat on Riot: https://riot.im/app/#/room/#ipfsconsortium:matrix.org


