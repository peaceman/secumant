'use strict';

const { createProcessSecutixLineItems } = require("../transform");
const { knex } = require("../database");
const { withSentry } = require("../sentry");
const { parseDate } = require("../util");

exports.command = 'process-line-items';
exports.desc = 'process line items';
exports.builder = yargs => {
    yargs
        .option('until-date', {
            describe: 'line items reference date including',
            type: 'string',
            default: undefined,
        });
};
exports.handler = withSentry(async argv => {
    const processSecutixLineItems = createProcessSecutixLineItems();

    const request = argv.untilDate
        ? { untilReferenceDateIncluding: parseDate(argv.untilDate) }
        : undefined;

    await processSecutixLineItems.execute(request);

    // required to let the cli command finish
    knex.destroy();
});
