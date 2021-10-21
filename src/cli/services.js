'use strict';

exports.command = 'services <comamnd>';
exports.desc = 'service management';
exports.builder = yargs => yargs.commandDir('services');
exports.handler = function () {};
