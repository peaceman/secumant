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
                processedAt: { type: ['string', 'null'], format: 'date-time', default: undefined },
            },
        };
    }

    static get relationMappings() {
        const { DiamantTransaction } = require('./diamant-transaction');

        return {
            diamantTransaction: {
                relation: Model.HasOneThroughRelation,
                modelClass: DiamantTransaction,
                join: {
                    from: 'secutix_line_items.id',
                    through: {
                        from: 'diamant_transaction_sources.secutix_line_item_id',
                        to: 'diamant_transaction_sources.diamant_transaction_id',
                    },
                    to: 'diamant_transactions.id',
                },
            },
        };
    }

    /**
     * @returns {boolean}
     */
    isComposedProduct() {
        return this.data.kind === 'COMPOSED_PRODUCT';
    }
}

module.exports = {
    SecutixLineItem,
};
