'use strict';

const { previousSunday } = require("date-fns");
const { Model } = require("objection");
const { SecutixLineItem } = require("../database/models");
const { DiamantTransaction, genRandomDiamantTransactionNumberSuffix } = require("../database/models/diamant-transaction");
const { SecutixLineAggregator } = require("../export/secutix-line-aggregator");
const { formatISODate } = require('../util');

class ProcessSecutixLineItems {
    /**
     * @param {SecutixLineAggregator} secutixLineAggregator
     */
    constructor(secutixLineAggregator) {
        /** @type {SecutixLineAggregator} */
        this.secutixLineAggregator = secutixLineAggregator;
    }

    async execute() {
        const lastSunday = previousSunday(new Date());
        const processedLineIds = [];

        for await (const lineItem of fetchLineItems(lastSunday)) {
            processedLineIds.push(lineItem.id);

            if (lineItem.isComposedProduct()) {
                continue;
            }

            this.secutixLineAggregator.feedLineItem(lineItem);
        }

        await Model.transaction(async trx => {
            for (const aggregate of this.secutixLineAggregator.getAggregatedRecords()) {
                await storeDiamantTransaction(trx, aggregate);
            }

            await markSecutixLineItemsAsProcessed(trx, processedLineIds);
        });
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
 * @param {import("../export/secutix-line-aggregator").AggregationLineItem} aggregate
 */
async function storeDiamantTransaction(trx, aggregate) {
    const txData = {
        referenceDate: aggregate.referenceDate,
        documentType: aggregate.documentType,
        vatRate: aggregate.vatRate,
        number: `${aggregate.groupingKey} ${genRandomDiamantTransactionNumberSuffix()}`,
        amount: aggregate.amount,
        secutixLineItems: (aggregate.sourceLineIds || []).map(id => ({id})),
        direction: aggregate.paymentSale,
        ledgerAccount: aggregate.ledgerAccount,
    };

    await DiamantTransaction.query(trx)
        .insertGraph(txData, {relate: true});
}

async function markSecutixLineItemsAsProcessed(trx, lineIds) {
    await SecutixLineItem.query(trx)
        .whereIn('id', lineIds)
        .patch({processedAt: new Date().toISOString()});
}


module.exports = {
    ProcessSecutixLineItems,
};
