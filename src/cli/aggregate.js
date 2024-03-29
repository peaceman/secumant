'use strict';

const { addDays, format } = require("date-fns");
const { SecutixLineItem } = require("../database/models");
const { createSecutixLineAggregator } = require("../transform");
const stream = require('stream');
const csv = require('csv');
const fs = require('fs');
const log = require("../log");
const { knex } = require("../database");
const { withSentry } = require("../sentry");
const { parseDate } = require('../util');

exports.command = 'aggregate <startDate> <endDate>';
exports.desc = 'aggregate';
exports.builder = yargs => {
    yargs
        .positional('startDate', {
            describe: 'line item reference date at which the aggregation should start',
            type: 'string',
        })
        .positional('endDate', {
            describe: 'line item reference date (inclusive) at which the aggregation should end',
            type: 'string',
        });
};

exports.handler = withSentry(async argv => {
    const startDate = parseDate(argv.startDate);
    const endDate = parseDate(argv.endDate);

    const aggregator = createSecutixLineAggregator();

    for await (const lineItem of provideLineItems(startDate, endDate)) {
        if (lineItem.data.kind === 'COMPOSED_PRODUCT') {
            continue;
        }

        aggregator.feedLineItem(lineItem);
    }

    const filenameBase = `${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`;
    const sourceFilename = `${filenameBase}_source.csv`;
    const aggregationFilename = `${filenameBase}_aggregation.csv`;
    const sourceFileStream = fs.createWriteStream(sourceFilename);
    const aggregationFileStream = fs.createWriteStream(aggregationFilename);

    stream.Readable
        .from(provideLineItems(startDate, endDate))
        .pipe(csv.transform(record => record.data))
        .pipe(csv.stringify({header: true}))
        .pipe(sourceFileStream);

    stream.Readable
        .from(aggregator.getAggregatedRecords())
        .pipe(csv.transform(record => ({
            ...record,
            sourceLineIds: record.sourceLineIds.join(', '),
        })))
        .pipe(csv.stringify({header: true}))
        .pipe(aggregationFileStream);

    const sourceFileStreamClosed = new Promise(resolve => sourceFileStream.on('close', resolve));
    const aggregationFileStreamClosed = new Promise(resolve => aggregationFileStream.on('close', resolve));

    await Promise.all([sourceFileStreamClosed, aggregationFileStreamClosed]);

    // required to let the cli command finish
    knex.destroy();
});

async function* provideLineItems(startDate, endDate) {
    let page = 0;

    while (true) {
        const result = await SecutixLineItem.query()
            .whereBetween('reference_date', [startDate, endDate])
            .orderBy('id', 'asc')
            .page(page, 100);

        const lineItems = result.results;
        yield *lineItems;

        if (lineItems.length === 0) {
            return;
        }

        page += 1;
    }
}
