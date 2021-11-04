'use strict';

const { SecutixLineItem } = require("../database/models");
const log = require("../log");
const { formatISODate } = require("../util");


/**
 * @typedef {Object} AggregationLineItem
 * @property {string} referenceDate
 * @property {string} groupingKey
 * @property {string} ledgerAccount FiBu-/Sachkonto
 * @property {string} documentType Belegart
 * @property {string} paymentSale
 * @property {number} amount
 * @property {number|undefined} vatRate
 * @property {string} sourceLineIds
 */

/**
 * @typedef {Object} AggregatorConfig
 * @property {string} paymentKindCash
 * @property {string} paymentKindCard
 * @property {object} operatorLedgerAccounts
 * @property {object} cardTypeLedgerAccounts
 * @property {object} cardTypeDocumentTypes
 * @property {object} ledgerAccountsWithVatRate
 * @property {AggregatorDataKeyConfig} dataKeyConfig
 */

/**
 * @typedef {Object} AggregatorDataKeyConfig
 * @property {string} accountingCode
 * @property {string} operatorName
 * @property {string} cardType
 * @property {string} ledgerAccount
 * @property {string} documentType
 * @property {string} vatRate
 * @property {string} paymentSale
 * @property {string} amount
 */

class SecutixLineAggregator {
    constructor(config) {
        log.info('Initializing aggregator');

        /**
         * reference date -> grouping key
         * @type {Map<string, Map<string, AggregationLineItem>>}
         */
        this.data = new Map();

        /** @type {AggregatorConfig} */
        this.config = config;

        this.ledgerAccountsWithVatRate = new Set(config.ledgerAccountsWithVatRate
            .map(v => String(v)));
    }

    /**
     * @public
     * @param {SecutixLineItem} lineItem
     */
    feedLineItem(lineItem) {
        const data = this.convertLineItem(lineItem);
        const perReferenceDate = this.getPerReferenceDate(data.referenceDate);

        if (perReferenceDate.has(data.groupingKey)) {
            aggregate(perReferenceDate.get(data.groupingKey), data);
        } else {
            perReferenceDate.set(data.groupingKey, data);
        }
    }

    /**
     * @private
     * @param {string} referenceDate
     * @returns {Map<string, AggregationLineItem>}
     */
    getPerReferenceDate(referenceDate) {
        if (!this.data.has(referenceDate)) {
            this.data.set(referenceDate, new Map());
        }

        return this.data.get(referenceDate);
    }

    /**
     * @public
     * @yields {AggregationLineItem}
     */
    * getAggregatedRecords() {
        for (const perReferenceDate of this.data.values()) {
            for (const aggregate of perReferenceDate.values()) {
                yield aggregate;
            }
        }
    }

    /**
     * @param {SecutixLineItem} lineItem
     * @returns {AggregationLineItem}
     */
    convertLineItem(lineItem) {
        const ledgerAccount = this.determineLedgerAccount(lineItem.data);

        const aggLineItem = {
            referenceDate: formatISODate(lineItem.referenceDate),
            groupingKey: this.determineGroupingKey(lineItem.data),
            ledgerAccount: this.determineLedgerAccount(lineItem.data),
            documentType: this.determineDocumentType(lineItem.data),
            paymentSale: lineItem.data[this.config.dataKeyConfig.paymentSale],
            amount: Number(lineItem.data[this.config.dataKeyConfig.amount]),
            vatRate: this.determineVatRate(ledgerAccount, lineItem.data),
            sourceLineIds: [lineItem.id],
        };

        return aggLineItem;
    }

    /**
     * @private
     * @param {string} ledgerAccount
     * @param {object} data
     * @returns {number|null}
     */
    determineVatRate(ledgerAccount, data) {
        if (!this.ledgerAccountsWithVatRate.has(ledgerAccount))
            return null;

        const vatRate = data[this.config.dataKeyConfig.vatRate];

        return vatRate !== undefined
            ? Number(vatRate)
            : null;
    }

    /**
     * @private
     * @param {object} data
     * @returns {string}
     */
    determineGroupingKey(data) {
        if (data.kind === this.config.paymentKindCash) {
            return `${this.config.paymentKindCash} ${data[this.config.dataKeyConfig.operatorName]}`;
        }

        if (data.kind === this.config.paymentKindCard) {
            return `Kartenzahlung ${data[this.config.dataKeyConfig.cardType]}`;
        }

        return data[this.config.dataKeyConfig.accountingCode];
    }

    /**
     * @private
     * @param {object} data
     * @returns {string}
     */
    determineLedgerAccount(data) {
        if (data.kind === this.config.paymentKindCash) {
            return this.getLedgerAccountForOperator(data[this.config.dataKeyConfig.operatorName]);
        }

        if (data.kind === this.config.paymentKindCard) {
            return this.getLedgerAccountForCard(data);
        }

        return data['ANALYTIC1'];
    }

    /**
     * @private
     * @param {string} operator
     * @returns {string}
     */
    getLedgerAccountForOperator(operator) {
        const ledgerAccount = this.config.operatorLedgerAccounts[operator] || '';

        if (ledgerAccount.length === 0) {
            log.error({operator}, 'Missing ledger account mapping for operator');
            throw new Error('Missing ledger account mapping for operator');
        }

        return ledgerAccount;
    }

    /**
     * @private
     * @param {object} data
     * @returns {string}
     */
    getLedgerAccountForCard(data) {
        const cardType = data[this.config.dataKeyConfig.cardType];
        const ledgerAccount = this.getLedgerAccountForCardType(cardType);

        if (ledgerAccount) {
            return ledgerAccount;
        }

        return data[this.config.dataKeyConfig.ledgerAccount];
    }

    /**
     * @private
     * @param {string} cardType
     * @returns {string|undefined}
     */
    getLedgerAccountForCardType(cardType) {
        return this.config.cardTypeLedgerAccounts[cardType];
    }

    /**
     * @private
     * @param {object} data
     * @returns {string}
     */
    determineDocumentType(data) {
        if (data.kind === this.config.paymentKindCard) {
            return this.getDocumentTypeForCard(data);
        }

        return data[this.config.dataKeyConfig.documentType];
    }

    /**
     * @private
     * @param {object} data
     * @returns {string}
     */
    getDocumentTypeForCard(data) {
        const cardType = data[this.config.dataKeyConfig.cardType];
        const documentType = this.getDocumentTypeForCardType(cardType);

        if (documentType) {
            return documentType;
        }

        return data[this.config.dataKeyConfig.documentType];
    }

    /**
     * @private
     * @param {string} cardType
     * @returns {string|undefined}
     */
    getDocumentTypeForCardType(cardType) {
        return this.config.cardTypeDocumentTypes[cardType];
    }
}

function aggregate(aggregate, lineItem) {
    checkProperties(aggregate, lineItem);

    aggregate.amount += lineItem.amount;
    aggregate.sourceLineIds.push(...lineItem.sourceLineIds);
}

function checkProperties(aggregate, lineItem) {
    const propsToCheck = [
        'ledgerAccount',
        'documentType',
        'paymentSale',
        'vatRate',
    ];

    for (const propName of propsToCheck) {
        if (aggregate[propName] !== lineItem[propName]) {
            log.error({aggregate, lineItem}, `${propName} mismatch`);
            throw new Error(`${propName} mismatch`);
        }
    }
}

module.exports = {
    SecutixLineAggregator,
};
