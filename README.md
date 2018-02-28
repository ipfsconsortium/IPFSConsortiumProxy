# IPFS Consortium proxy

This script watches a consortium proxy contract and pins/unpins IPFS data on your local
IPFS server according to the Events that flow through the monitored contracts.

# Installation

`npm install ipfsconsortiumproxy`

## Configuration

### Option 1 : Environment variables

You can set a number of environment variables to configure the script:

```
IPFSAPIHOST=localhost
IPFSAPIPORT=5001
WEB3HOSTWS="ws://localhost:8546"
CONTRACTADDRESS="0x7433c7c768be4025ab791fb7b2942c3d9e309f3e"
STARTBLOCK=4090116
```

### Option 2 : .ENV file

Check / modify the settings in the enclosed .env-dist file

By default the IPFS API is assumed to be on `localhost` port `5001` using the HTTP protocol
The Ethereum node connects through a websocket on `localhost` port `8546`

### Option 3 : command line parameters

```
ipfsconsortiumproxy  --ipfsapihost localhost --ipfsapiport 5001 --web3hostws "ws://localhost:8546" --contractaddress '0x7433c7c768be4025ab791fb7b2942c3d9e309f3e' --startblock 4090116
```

Type `ipfsconsortiumproxy -h` for more info about the available parameters.

## Running

just type `ipfsconsortiumproxy` to start it up.


## How does the consortium work ?

The consortium is managed by a smart contract deployed here 

* Livenet `0x7433c7c768be4025ab791fb7b2942c3d9e309f3e` ( startblock 4090116 )
* Rinkeby `0x3ef882ffcE8fC40f6Ca473f29AC16dE8a60419BB` ( startblock 1846107 )

## How can I join the consortium ?

* Go to the IPFSConsortium chat on Riot ( see below ) and ask for access
* OR: Deploy your own version of the contract, and start your own consortium

## How can I help support the IPFS consortium ?

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


