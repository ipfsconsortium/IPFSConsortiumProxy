'use strict';
const winston = require('winston');

const format = winston.format.printf((info) => {
	return `${info.timestamp} ${info.level.toUpperCase()} [${info.label}] : ${info.message}`;
});

/**
 * Get a label to desribe the module we're logging for.
 *
 * @param {Object}  mod The module we're logging for or a description of the
 *                      logger.
 * @return {winston.format.label}
 */
function _getLabel(mod) {
	let label = mod;
	if (mod == undefined) {
		mod = module;
	}
	if (mod.id) {
		label = mod.id.replace('.js', '');
		label = label.replace(/^.*\/src\//, '');
	}
	return winston.format.label({
		'label': label
	});
}

module.exports = function(mod) {
	const logger = winston.createLogger({
		level: process.env.LOG_LEVEL || 'info',
		format: winston.format.combine(
			winston.format.splat(),
			winston.format.timestamp(),
			_getLabel(mod),
			format
		),
		transports: [new winston.transports.Console()],
	});
	return logger;
};
