'use strict';

const { exportDiamantTransactions } = require("../export");
const log = require("../log");
const { knex } = require("../database");

exports.command = 'export-transactions';
exports.desc = 'exports diamant transactions';
exports.builder = yargs => {
    yargs
        .option('start-date', {
            describe: 'transaction reference start date',
            type: 'string',
        })
        .option('end-date', {
            describe: 'transaction reference end date',
            type: 'string',
        });
};
exports.handler = async argv => {
    const exportRequest = {
        startDate: argv.startDate ? parseDate(argv.startDate) : undefined,
        endDate: argv.endDate ? parseDate(argv.endDate) : undefined,
    };

    await exportDiamantTransactions.execute(exportRequest);

    // required to let the cli command finish
    knex.destroy();
};

function parseDate(dateString) {
    const date = new Date(dateString);

    if (date.toString() === 'Invalid Date') {
        throw `Invalid date '${dateString}'`;
    }

    return date;
}
