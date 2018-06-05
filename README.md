# IPFS Consortium proxy

This *IPFS consortium tool* allows you to jointly host IPFS data in a with a group of other IPFS users ( called a consortium ).

The Proxy script watches a consortium smart-contract and pins/unpins IPFS data on your local
IPFS server according to the Events that flow through the contract, and other contracts that can be added by members of the same consortium.

What problems does IPFS Pinning Consortium try to solve ?

- Governance about membership of a consortium for sharing IPFS hashed data
- An interface to add IPFS hashes to a consortium
 - a single IPFS hash
 - a metadata object containing an extendible stuctured format to add hashes ( e.g. a manifest of hashes )
- A definition of the metadata format (a JSON schema)
- A client utility to support and automate persisting data ( a.k.a pinning IPFS hashes )
- Proof of Persistence : status reporting among consortium members


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
ipfsconsortiumproxy \
 --ipfsapihost localhost \
 --ipfsapiport 5001 \
 --web3hostws "ws://localhost:8546" \
 --contractaddress '0xf5758D7450a6E7076d99db583f037B47b5135744' \
 --startblock 5450081 \
```


Type `ipfsconsortiumproxy -h` for more info about the available parameters.

## Running

just type `ipfsconsortiumproxy` to start it up.


## How does a consortium work ?

A consortium is managed by a smart contract. A few example consortium contracts are deployed here 

* Livenet `0xf5758D7450a6E7076d99db583f037B47b5135744 ` ( startblock 5450081 )
* Rinkeby `0x3ef882ffcE8fC40f6Ca473f29AC16dE8a60419BB` ( startblock 1846107 )

The IPFS Solidity code can be found here :
https://github.com/ipfsconsortium/IPFSConsortiumContracts/tree/master/contracts

## How can I create my own consortium ?

* Go to the IPFSConsortium chat on Riot ( see below ) and ask for help
* OR: Deploy your own version of the contract, and start your own consortium
* OR: Join an existing consortium - talk to people in our Riot channel

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


