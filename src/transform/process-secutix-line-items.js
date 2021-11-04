'use strict';

const { previousSunday } = require("date-fns");
const { Model } = require("objection");
const { SecutixLineItem } = require("../database/models");
const { DiamantTransaction, genRandomDiamantTransactionNumberSuffix } = require("../database/models/diamant-transaction");
const { SecutixLineAggregator } = require("./secutix-line-aggregator");
const { formatISODate } = require('../util');
const log = require('../log');

class ProcessSecutixLineItems {
    /**
     * @param {SecutixLineAggregator} secutixLineAggregator
     */
    constructor(secutixLineAggregator) {
        /** @type {SecutixLineAggregator} */
        this.secutixLineAggregator = secutixLineAggregator;
    }

    async execute() {
        log.info('Start processing secutix line items');

        const lastSunday = previousSunday(new Date());
        const ignoredLineIds = [];

        log.info({lastSunday}, 'Aggregating line items');
        for await (const lineItem of fetchLineItems(lastSunday)) {
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
                    await storeDiamantTransaction(aggregate, trx);
                    await markSecutixLineItemsAsProcessed(aggregate.sourceLineIds, trx);
                });
            } catch (error) {
                log.error({error, aggregate}, 'Failed to store diamant transaction');
            }
        }

        log.info('Finished processing secutix line items');
    }
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
    };

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
