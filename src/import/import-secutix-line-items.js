'use strict';

const { subYears, differenceInSeconds } = require('date-fns');
const { SecutixLineItem } = require('../database/models');
const log = require('../log');
const { DataExportService } = require('../secutix');

/**
 * @typedef {Object} ImportSecutixLineItemsRequest
 * @property {number} maxRuntimeSec
 */

class ImportSecutixLineItems {
    /**
     * @param {DataExportService} dataExportService
     * @param {string} exportQuery
     */
    constructor(
        dataExportService,
        exportQuery,
    ) {
        /** @type {DataExportService} */
        this.dataExportService = dataExportService;
        /** @type {string} */
        this.exportQuery = exportQuery;
    }

    /**
     * @param {ImportSecutixLineItemsRequest} importRequest
     */
    async execute(importRequest = { maxRuntimeSec: 50 }) {
        log.info('Start importing secutix line items');
        const startedAt = new Date();

        while (true) {
            if (differenceInSeconds(new Date(), startedAt) >= importRequest.maxRuntimeSec) {
                log.info('Reached max runtime during secutix line item import');
                break;
            }

            const lastFlagDate = await determineLastFlagDate();
            log.info(
                {flagDate: lastFlagDate, exportQuery: this.exportQuery},
                'Secutix execute line item export'
            );

            const exportResult = await this.dataExportService
                .executeExport(this.exportQuery, lastFlagDate);

            if ((exportResult.elements || []).length === 0) {
                log.info({flagDate: lastFlagDate}, 'Secutix line item export was empty');
                break;
            }

            const lineItems = await storeLineItems(exportResult.elements);
            await this.flagLineItems(lineItems);
        }

        log.info('Finished importing secutix line items');
    }

    async flagLineItems(lineItems) {
        const idsToFlag = lineItems
            .filter(li => !li.flaggedAt)
            .map(li => li.id);

        const flagDate = new Date();
        log.info(
            {
                lineItemIds: idsToFlag,
                flagDate,
                alreadyFlagged: lineItems.length - idsToFlag.length
            },
            'Flag line items in secutix',
        );

        await this.dataExportService.flagItems(idsToFlag, { flagDate });

        await SecutixLineItem.query()
            .patch({ flaggedAt: flagDate.toISOString() })
            .whereIn('id', idsToFlag);
    }
}

async function determineLastFlagDate() {
    const lineItem = await SecutixLineItem.query()
        .orderBy('flagged_at', 'desc')
        .first();

    return lineItem?.flaggedAt || subYears(new Date(), 1);
}

async function storeLineItems(lineItems) {
    return await SecutixLineItem.transaction(async trx => {
        return await Promise.all(lineItems.map(async lineItem => {
            let dbLineItem = await SecutixLineItem.query(trx)
                .findById(lineItem['line_id']);

            if (!dbLineItem) {
                dbLineItem = await SecutixLineItem.query(trx)
                    .insertAndFetch({
                        id: lineItem['line_id'],
                        referenceDate: lineItem['reference_date'],
                        data: lineItem,
                    });
            }

            return dbLineItem;
        }));
    });
}

module.exports = {
    ImportSecutixLineItems,
};
