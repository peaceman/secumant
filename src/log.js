'use strict';

const bunyan = require("bunyan");

const log = bunyan.createLogger({
    name: 'secumant',
});

module.exports = log;
