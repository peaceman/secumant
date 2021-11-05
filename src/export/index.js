'use strict';

const config = require('config');
const { transactionService } = require("../diamant");
const { ExportDiamantTransactions } = require("./export-diamant-transactions");

const exportDiamantTransactions = new ExportDiamantTransactions(
    {
        clearingAccount: config.get('aggregation.clearingAccount'),
        taxCodeMapping: config.get('aggregation.taxCodeMapping'),
    },
    transactionService,
);

module.exports = {
    exportDiamantTransactions,
};
