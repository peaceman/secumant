'use strict';

const { SecutixLineAggregator } = require("./secutix-line-aggregator");
const config = require('config');

function createSecutixLineAggregator() {
    return new SecutixLineAggregator(config.get('aggregation'));
}

module.exports = {
    createSecutixLineAggregator,
};
