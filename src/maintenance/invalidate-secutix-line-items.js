'use strict';

const { DataExportService } = require("../secutix/data-export");
const { TransactionService } = require('../diamant/transaction');
const { SecutixLineItem } = require("../database/models");
const log = require("../log");
const { formatISODate } = require("../util");
const { DiamantTransaction } = require("../database/models/diamant-transaction");

/**
 * @typedef {Object} InvalidateSecutixLineItemsRequest
 * @property {Date} startDate
 * @property {Date} endDate
 */

class InvalidateSecutixLineItems {
    /**
     * @param {DataExportService} secutixDataExportService
     * @param {TransactionService} diamantTransactionService
     */
    constructor(
        secutixDataExportService,
        diamantTransactionService
    ) {
        /** @type {DataExportService} */
        this.secutixDataExportService = secutixDataExportService;
        /** @type {TransactionService} */
        this.diamantTransactionService = diamantTransactionService;
    }

    /**
     * @public
     * @param {InvalidateSecutixLineItemsRequest} request
     */
    async execute(request) {
        for await (const lineItems of fetchLineItemsPerRefDate(request)) {
            const lineItemIds = lineItems.map(li => li.id);

            for await (const transaction of fetchTransactionsForLineItemIds(lineItemIds)) {
                await this.reverseTransaction(transaction);
            }

            log.info({lineItemIds}, 'Unflag secutix line items');
            await this.secutixDataExportService.unflagItems(lineItemIds);
            await SecutixLineItem.query()
                .whereIn('id', lineItemIds)
                .delete();
        }
    }

    /**
     * @private
     * @param {DiamantTransaction} transaction
     */
    async reverseTransaction(transaction) {
        if (transaction.key) {
            log.info({transaction}, 'Reverse diamant transaction');
            await this.diamantTransactionService.reverse(transaction.key);
        }

        log.info({transaction}, 'Delete diamant transaction');
        await transaction.$query().delete();
    }
}

/**
 * @param {InvalidateSecutixLineItems} request
 */
async function* fetchLineItemsPerRefDate({ startDate, endDate }) {
    const q = SecutixLineItem.query()
        .whereBetween('reference_date', [startDate, endDate])
        .orderBy([
            { column: 'reference_date', order: 'asc' },
            { column: 'id', order: 'asc' },
        ]);

    let currentLineItems = [];
    let pageIdx = 0;
    let currentRefDate = undefined;

    pagingLoop:
    while (true) {
        const cq = q.clone().page(pageIdx, 100);
        const result = await cq;

        if (result.results.length === 0)
            break;

        for (const li of result.results) {
            if (currentRefDate === undefined) {
                currentRefDate = li.referenceDate;
            }

            if (formatISODate(li.referenceDate) !== formatISODate(currentRefDate)) {
                currentRefDate = undefined;

                yield currentLineItems;
                currentLineItems = [];

                pageIdx = 0;
                continue pagingLoop;
            }

            currentLineItems.push(li);
        }

        pageIdx += 1;
    }

    if (currentLineItems.length !== 0)
        yield currentLineItems;
}

async function* fetchTransactionsForLineItemIds(lineItemIds) {
    const q = DiamantTransaction.query()
        .whereExists(DiamantTransaction.relatedQuery('secutixLineItems')
            .whereIn('id', lineItemIds))
        .limit(100);

    let lastId = undefined;
    while (true) {
        const cq = q.clone();
        if (lastId !== undefined) {
            cq.andWhere('diamant_transactions.id', '>', lastId);
        }

        const transactions = await cq;
        if (transactions.length === 0) {
            return;
        }

        for (const tx of transactions) {
            lastId = tx.id;
            yield tx;
        }
    }
}

module.exports = {
    InvalidateSecutixLineItems,
};
