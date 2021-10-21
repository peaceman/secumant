'use strict';

const { ImportSecutixLineItems } = require('./import-secutix-line-items');
const config = require('config');
const { dataExportService } = require('../secutix');

const importSecutixLineItems = new ImportSecutixLineItems(
    dataExportService,
    config.get('secutix.exportQuery'),
);

module.exports = {
    importSecutixLineItems,
};
