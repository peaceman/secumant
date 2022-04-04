'use strict';

const { invalidateSecutixLineItems } = require('../maintenance');
const log = require('../log');
const { knex } = require('../database');
const { withSentry } = require("../sentry");

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
        });
};

exports.handler = withSentry(async argv => {
    const invalidateRequest = {
        startDate: parseDate(argv.startDate),
        endDate: parseDate(argv.endDate),
    };

    await invalidateSecutixLineItems.execute(invalidateRequest);

    // required to let the cli command finish
    knex.destroy();
});

function parseDate(dateString) {
    const date = new Date(dateString);

    if (date.toString() === 'Invalid Date') {
        throw `Invalid date '${dateString}'`;
    }

    return date;
}
