'use strict';

const { withSentry } = require("../sentry");
const { parseDate } = require('../util');

exports.command = 'report-transactions <start-date> <end-date>';
exports.desc = 'reports diamant transactions';
exports.builder = yargs => {
    yargs
        .option('start-date', {
            describe: 'transaction creation start date',
            type: 'string',
        })
        .option('end-date', {
            describe: 'transaction creation end date',
            type: 'string',
        });
};

exports.handler = withSentry(async argv => {
    const { reportDiamantTransactions } = require("../export");
    const { knex } = require("../database");

    const reportingPeriod = {
        from: parseDate(argv.startDate),
        until: parseDate(argv.endDate),
    };

    await reportDiamantTransactions.execute(reportingPeriod);

    // required to let the cli command finish
    knex.destroy();
});
