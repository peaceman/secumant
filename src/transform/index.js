'use strict';

const config = require('config');
const { ProcessSecutixLineItems } = require("./process-secutix-line-items");
const { SecutixLineAggregator } = require('./secutix-line-aggregator');

/**
 * @returns {ProcessSecutixLineItems}
 */
function createProcessSecutixLineItems() {
    const aggregator = createSecutixLineAggregator();

    return new ProcessSecutixLineItems(aggregator);
}

function createSecutixLineAggregator() {
    return new SecutixLineAggregator(config.get('aggregation'));
}

module.exports = {
    createProcessSecutixLineItems,
    createSecutixLineAggregator,
};
