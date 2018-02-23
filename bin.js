#!/usr/bin/env node
'use strict'

let ipfsconsortiumproxy = require('./src/lib/ipfsconsortiumproxy-cli.js')

var cli = new ipfsconsortiumproxy();
cli.go();
