'use strict';

const { Model } = require('objection');
const BaseModel = require('./base');
const cryptoRandomString = require('crypto-random-string');

class DiamantTransaction extends BaseModel {
    static get tableName() {
        return 'diamant_transactions';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            required: [
                'referenceDate',
                'documentType',
                'number',
                'amount',
                'direction',
                'ledgerAccount',
            ],
            properties: {
                id: { type: 'string' },
                referenceDate: { type: 'string', format: 'date' },
                documentType: { type: 'string' },
                vatRate: { type: 'number' },
                number: { type: 'string' },
                direction: { type: 'string', enum: ['P', 'S'] },
                ledgerAccount: { type: ['number', 'string'] },
                amount: { type: ['number', 'string'] },
                key: { type: 'string' },
            }
        };
    }

    static get relationMappings() {
        const { SecutixLineItem } = require('./secutix-line-item');

        return {
            secutixLineItems: {
                relation: Model.ManyToManyRelation,
                modelClass: SecutixLineItem,
                join: {
                    from: 'diamant_transactions.id',
                    through: {
                        from: 'diamant_transaction_sources.diamant_transaction_id',
                        to: 'diamant_transaction_sources.secutix_line_item_id',
                    },
                    to: 'secutix_line_items.id',
                },
            },
        };
    }
}

function genRandomDiamantTransactionNumberSuffix() {
    return cryptoRandomString({ length: 4, type: 'alphanumeric' });
}

module.exports = {
    DiamantTransaction,
    genRandomDiamantTransactionNumberSuffix,
};
