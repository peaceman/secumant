'use strict';

const bunyan = require("bunyan");

const log = bunyan.createLogger({
    name: 'secumant',
    serializers: bunyan.stdSerializers,
});

module.exports = log;
