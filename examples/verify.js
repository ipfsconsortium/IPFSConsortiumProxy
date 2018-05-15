var Validator = require('jsonschema').Validator;
var v = new Validator();
var instance = require('./metadata-manifest.json');
var schema = require('./metadata-schema-0-1-0.json');
console.log(v.validate(instance, schema));
