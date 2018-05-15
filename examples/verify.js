const Validator = require('jsonschema').Validator;
const instance = require('./metadata-manifest.json');
const schema = require('../spec/metadata-spec.json');

let v = new Validator();
let validation = v.validate(instance, schema);
if(validation.errors.length !== 0){
	console.log(validation.errors);
}else{
	console.log('file is valid');
}
