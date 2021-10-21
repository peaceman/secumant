'use strict';

const { Model } = require('objection');
const BaseModel = require('./base');

class SecutixLineItem extends BaseModel {
    static get tableName() {
        return 'secutix_line_items';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            required: [
                'id',
                'referenceDate',
                'data',
            ],
            properties: {
                id: { type: 'string' },
                referenceDate: { type: 'string', format: 'date' },
                data: { type: 'object' },
                flaggedAt: { type: ['string', 'null'], format: 'date-time', default: undefined },
            },
        };
    }
}

module.exports = SecutixLineItem;
