#!/usr/bin/env node
'use strict';

const IPFSConsortiumProxy = require('./src/lib/ipfsconsortiumproxy-cli.js');
const cli = new IPFSConsortiumProxy();
cli.go();
