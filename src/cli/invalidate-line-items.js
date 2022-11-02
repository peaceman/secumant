'use strict';

const { invalidateSecutixLineItems } = require('../maintenance');
const log = require('../log');
const { knex } = require('../database');
const { withSentry } = require("../sentry");
const { parseDate } = require('../util');

exports.command = 'invalidate-line-items <start-date> <end-date>';
exports.desc = 'invalidates secutix line items and their corresponding diamant transactions';
exports.builder = yargs => {
    yargs
        .positional('start-date', {
            describe: 'line item reference start date',
            type: 'string'
        })
        .positional('end-date', {
            describe: 'line item reference end date',
            type: 'string',
        })
        .option('include-processed', {
            describe: 'invalidate already processed line items and reverse their corresponding diamant transactions',
            type: 'boolean',
            default: false,
        })
};

exports.handler = withSentry(async argv => {
    const invalidateRequest = {
        startDate: parseDate(argv.startDate),
        endDate: parseDate(argv.endDate),
        includeProcessed: argv.includeProcessed,
    };

    await invalidateSecutixLineItems.execute(invalidateRequest);

    // required to let the cli command finish
    knex.destroy();
});
