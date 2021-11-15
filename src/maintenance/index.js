'use strict';

const { InvalidateSecutixLineItems } = require('./invalidate-secutix-line-items');
const { transactionService } = require("../diamant");
const { dataExportService } = require('../secutix');

const invalidateSecutixLineItems = new InvalidateSecutixLineItems(
    dataExportService,
    transactionService,
);

module.exports = {
    invalidateSecutixLineItems,
};
