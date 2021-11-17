'use strict';

const { DiamantTransaction } = require("../database/models/diamant-transaction");
const { TransactionService } = require("../diamant/transaction");
const log = require("../log");

/**
 * @typedef {Object} ExportDiamantTransactionsConfig
 * @property {string} clearingAccount
 * @property {Object} taxCodeMapping String(vatRate) -> taxCode
 */

/**
 * @typedef {Object} ExportDiamantTransactionsRequest
 * @property {Date|undefined} startDate
 * @property {Date|undefined} endDate
 */

class ExportDiamantTransactions {
    /**
     * @param {ExportDiamantTransactionsConfig} config
     * @param {TransactionService} transactionService
     */
    constructor(config, transactionService) {
        /** @type {ExportDiamantTransactionsConfig} */
        this.config = config;
        /** @type {TransactionService} */
        this.transactionService = transactionService;
    }

    /**
     * @public
     * @param {ExportDiamantTransactionsRequest} request
     */
    async execute({ startDate, endDate } = {}) {
        log.info('Start exporting diamant transactions');

        for await (const tx of fetchTransactions(startDate, endDate)) {
            const txData = this.convertTransaction(tx);

            try {
                const txKey = await this.transactionService.create(txData);
                await tx.$query().patch({key: txKey});
            } catch (error) {
                log.error({error, tx, txData}, 'Failed to export transaction to diamant');
            }
        }

        log.info('Finished exporting diamant transactions');
    }

    /**
     * @private
     * @param {DiamantTransaction} tx
     * @returns {import("../diamant/transaction").Transaction}
     */
    convertTransaction(tx) {
        const accounts = {
            'P': { debit: tx.ledgerAccount, credit: this.config.clearingAccount },
            'S': { debit: this.config.clearingAccount, credit: tx.ledgerAccount },
        };

        const ledgerAccountAdditions = {
            taxCode: this.config.taxCodeMapping[String(tx.vatRate)],
            costCenter: tx.costCenter || undefined,
            costObject: tx.costObject || undefined,
        };

        const isLedgerAccount = acc => acc === tx.ledgerAccount;
        const genAccountAssignment = (type, accounts) => {
            const account = accounts[type];

            const assignment = {
                account,
                [type]: tx.amount / 100,
            };

            return isLedgerAccount(account)
                ? {...assignment, ...ledgerAccountAdditions}
                : assignment;
        };

        return {
            type: tx.documentType,
            date: tx.referenceDate,
            number: tx.number,
            accountAssignments: [
                genAccountAssignment('debit', accounts[tx.direction]),
                genAccountAssignment('credit', accounts[tx.direction]),
            ],
        };
    }
}

/**
 * @param {Date|undefined} startDate inclusive
 * @param {Date|undefined} endDate inclusive
 */
async function* fetchTransactions(startDate, endDate) {
    const query = DiamantTransaction.query()
        .whereNull('key')
        .orderBy('reference_date', 'ASC');

    if (startDate) {
        query.where('reference_date', '>=', startDate);
    }

    if (endDate) {
        query.where('reference_date', '<=', endDate);
    }

    yield* (await query);
}

module.exports = {
    ExportDiamantTransactions,
};
