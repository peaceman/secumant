'use strict';

const { createSecutixLineAggregator } = require("../export");
const { ProcessSecutixLineItems } = require("./process-secutix-line-items");

/**
 * @returns {ProcessSecutixLineItems}
 */
function createProcessSecutixLineItems() {
    const aggregator = createSecutixLineAggregator();

    return new ProcessSecutixLineItems(aggregator);
}

module.exports = {
    createProcessSecutixLineItems,
};
