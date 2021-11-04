'use strict';

const { createProcessSecutixLineItems } = require("../transform");
const { knex } = require("../database");

exports.command = 'process-line-items';
exports.desc = 'process line items';
exports.handler = async argv => {
    const processSecutixLineItems = createProcessSecutixLineItems();
    await processSecutixLineItems.execute();

    // required to let the cli command finish
    knex.destroy();
};
