'use strict';

const { previousSunday, subDays } = require("date-fns");
const { Model, UniqueViolationError } = require("objection");
const { SecutixLineItem } = require("../database/models");
const { DiamantTransaction, genRandomDiamantTransactionNumberSuffix } = require("../database/models/diamant-transaction");
const { SecutixLineAggregator } = require("./secutix-line-aggregator");
const { formatISODate } = require('../util');
const log = require('../log');

/**
 * @typedef {Object} ProcessSecutixLineItemsRequest
 * @property {Date} untilReferenceDateIncluding
 */

class ProcessSecutixLineItems {
    /**
     r @param {SecutixLineAggregator} secutixLineAggregator
     */
    constructor(secutixLineAggregator) {
        /** @type {SecutixLineAggregator} */
        this.secutixLineAggregator = secutixLineAggregator;
    }

    /**
     * @public
     * @param {ProcessSecutixLineItemsRequest|undefined} request
     */
    async execute(request) {
        log.info('Start processing secutix line items');

        if (!request) {
            request = { untilReferenceDateIncluding: new Date() };
        }

        const ignoredLineIds = [];

        log.info(
            { untilReferenceDateIncluding: request.untilReferenceDateIncluding },
            'Aggregating line items'
        );

        for await (const lineItem of fetchLineItems(request.untilReferenceDateIncluding)) {
            if (lineItem.isComposedProduct()) {
                ignoredLineIds.push(lineItem.id);
                continue;
            }

            this.secutixLineAggregator.feedLineItem(lineItem);
        }

        log.info('Mark ignored line ids as processed');
        await markSecutixLineItemsAsProcessed(ignoredLineIds);

        log.info('Store diamant transactions');
        for (const aggregate of this.secutixLineAggregator.getAggregatedRecords()) {
            try {
                await Model.transaction(async trx => {
                    if (aggregate.amount !== 0) {
                        await retryOnError(UniqueViolationError, 2, async () => {
                            await storeDiamantTransaction(aggregate, trx);
                        });
                    }

                    await markSecutixLineItemsAsProcessed(aggregate.sourceLineIds, trx);
                });
            } catch (error) {
                log.error({err: error, aggregate}, 'Failed to store diamant transaction');
            }
        }

        log.info('Finished processing secutix line items');
    }
}

async function retryOnError(errorType, retries, fn) {
    let lastError = undefined;

    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            if (e instanceof errorType) {
                continue;
            }
        }
    }

    throw lastError;
}

/**
 * @param {Date} beforeDate
 * @yields {SecutixLineItem}
 */
async function* fetchLineItems(beforeDate) {
    let page = 0;

    while (true) {
        const result = await SecutixLineItem.query()
            .where('reference_date', '<=', formatISODate(beforeDate))
            .whereNull('processed_at')
            .orderBy('id', 'asc')
            .page(page, 100);

        const lineItems = result.results;
        yield* lineItems;

        if (lineItems.length === 0) {
            return;
        }

        page += 1;
    }
}

/**
 * @param {import("./secutix-line-aggregator").AggregationLineItem} aggregate
 */
async function storeDiamantTransaction(aggregate, trx) {
    const txData = {
        referenceDate: aggregate.referenceDate,
        documentType: aggregate.documentType,
        vatRate: aggregate.vatRate,
        number: genDiamantTransactionNumber(aggregate.groupingKey),
        amount: aggregate.amount,
        secutixLineItems: (aggregate.sourceLineIds || []).map(id => ({id})),
        direction: aggregate.paymentSale,
        ledgerAccount: aggregate.ledgerAccount,
        costCenter: aggregate.costCenter,
        costObject: aggregate.costObject,
    };

    log.info({ number: txData.number }, "Store diamant transaction");

    await DiamantTransaction.query(trx)
        .insertGraph(txData, {relate: true});
}

function genDiamantTransactionNumber(groupingKey) {
    return `${groupingKey.slice(0, 15 - 5).trim()} ${genRandomDiamantTransactionNumberSuffix()}`;
}

async function markSecutixLineItemsAsProcessed(lineIds, trx) {
    await SecutixLineItem.query(trx)
        .whereIn('id', lineIds)
        .patch({processedAt: new Date().toISOString()});
}

module.exports = {
    ProcessSecutixLineItems,
};
