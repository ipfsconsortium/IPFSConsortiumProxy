# IPFS Consortium proxy

This *IPFS consortium tool* allows you to jointly host IPFS data in a with a group of other IPFS users ( called a consortium ).

The IPFS consortium is configured by an array of participants in the consortium that can propose manifest files of IPFS hashes to be pinned by the members in the consortium.

What problems does IPFS Pinning Consortium try to solve ?

- A structured metadata format to describe `consortium` details and `manifest` files of IPFS hashes.
- A formal description of the metadata format (a JSON schema)
- A client utility to support and automate persisting data ( a.k.a pinning IPFS hashes )
- Proof of Persistence (TODO) : status reporting among consortium members

# Installation

## Via npm

`npm install ipfsconsortiumproxy`

## Via [DappNode](https://github.com/dappnode/DAppNode)

`/ipfs/QmXVaWaW9CyTpx6CU4hP9M7Tg9eAvagnf4WCWuqokD1AEu`

# Configuration

## Option 1 : Environment variables

You can set a number of environment variables to configure the script:

```
IPFSAPIHOST=localhost
IPFSAPIPORT=5001
WEB3HOSTWS="ws://localhost:8546"
```

## Option 2 : .ENV file

Check / modify the settings in the enclosed .env-dist file

By default the IPFS API is assumed to be on `localhost` port `5001` using the HTTP protocol
The Ethereum node connects through a websocket on `localhost` port `8546`

## Option 3 : command line parameters

```
ipfsconsortiumproxy \
 --ipfsapihost localhost \
 --ipfsapiport 5001 \
 --web3hostws "ws://localhost:8546" \
```

Type `ipfsconsortiumproxy -h` for more info about the available parameters.

# Running

just type `ipfsconsortiumproxy` to start it up.


# How does a consortium work ?

The consortium is configured by a consortium config file that is hosted on IPFS. 

## Consortium config file

The consortium config file is retrieved from ENS. It currently reads the `text` record from 
`consortium.dappnode.eth` with the key `consortium`. This should resolve to an IPFS hash 
with the format 

```/ipfs/<IPFSHASH>```

If you resolve this IPFS hash - you will get a consortium config file.

The format of the config is as follows :

```
{
	"type": "consortium",
	"quotum": "100000000000",
	"members": [
		{
			"ensname": "consortium.dappnode.eth",
			"quotum": "10000000000"
		},
		...
	]
}
```

Where

- `quotum` is the total file size in bytes that all members combined of this consortium
can ever store.
- `members` is the list of members , each containing their `ensname` pointing to the manifest of IPFS hashes they want to persist (see below) and a member `quotum` specifying the maximum
amount of bytes this member is allowed to store in this consortium.

## Member manifest file

Each member of the consortium should define an ENS name (eg. `consortium.dappnode.eth`) with 
a `text` record with the key `consortiumManifest` pointing again to an IPFS hash of the format


```/ipfs/<IPFSHASH>```

This IPFS hash must resolve to a JSON payload of the following format :

```
{
	"type": "manifest",
	"quotum": "10000000000",
	"pin": [
		"/ipfs/<IPFSHASH>",
		"/ipfs/<IPFSHASH>",
		...
		"/ipfs/<IPFSHASH>"
	]
}

```

Where

- `quotum` is the capacity the member currently requires (should be smaller or equal to the 
members' quotum in the consortium config - the quotum in the consortium config has precedence over this value)
- `pin` is an array of IPFS hashes to pin
- `unpin` is an array of IPFS hashes to unpin (optional)

# How can I create my own consortium ?

* Go to the IPFSConsortium chat on Riot ( see below ) and ask for help
* OR: Deploy your own payload to ENS - modify the config file and start your own consortium
* OR: Join an existing consortium - talk to people in our Riot channel

# How can I help support the IPFS consortium ?

## Running an IPFS consortium node

### Via DappNode

Setup a [DappNode](https://github.com/dappnode/DAppNode) - install this app and start listening to one or more IPFS consortium ENS configurations.

### Standalone

just install the npm module + an IPFS node and run the script

`npm install -g ipfsconsortiumproxy`
`ipfsconsortiumproxy <options>`


# Contributing to the development

We use ZenHub as a project management tool for this project.

- Install the ZenHub chrome plugin ( https://chrome.google.com/webstore/detail/zenhub-for-github/ogcgkffhplmphkaahpmffcafajaocjbd )
- visit the project board : https://github.com/ipfsconsortium/pm/issues/2#boards?repos=106814113
- check the `backlog` and `new issues` pipeline 

If you don't want to install this plugin , just check the issues on the project 

# Get in touch

- IPFSConsortium chat on Riot: https://riot.im/app/#/room/#ipfsconsortium:matrix.org


