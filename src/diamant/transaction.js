'use strict';

const { trimEnd, trimStart } = require('lodash');
const soap = require('soap');
const log = require('../log');
const { apiCall } = require('../util/soap');
const { BaseService } = require('./base');
const { SessionService } = require('./session');

const SERVICE_WSDL_PATH = '/WS3Trans/TransactionService.asmx?wsdl';

/**
 * @typedef {Object} Transaction
 * @property {number} key
 * @property {string} type
 * @property {Date} date
 * @property {string} number
 * @property {AccountAssignment[]} accountAssignments
 */

/**
 * @typedef {Object} AccountAssignment
 * @property {number} key
 * @property {string} account
 * @property {string} text
 * @property {number} taxCode
 * @property {number} credit
 * @property {number} debit
 */

class TransactionService extends BaseService {
    /**
     * @param {import('.').ApiConfig} apiConfig
     * @param {import('.').SoapClientFactory} soapClientFactory
     * @param {SessionService} sessionService
     */
    constructor(apiConfig, soapClientFactory, sessionService) {
        super(apiConfig, soapClientFactory);

        /** @type {SessionService} */
        this.sessionService = sessionService;
    }

    get serviceWsdlPath() {
        return SERVICE_WSDL_PATH;
    }

    /**
     * @public
     * @param {Transaction} transaction
     * @returns {number|string} diamant transaction key
     */
    async create(transaction) {
        const sessionKey = await this.sessionService.getSessionKey();

        const body = {
            session: sessionKey,
            data: {
                TransactionType: transaction.type,
                TransDate: transaction.date.toISOString(),
                TransNumber: transaction.number,
                Currency: 'EUR',
                AccountAssignmentTab: {
                    AccountAssignment: (transaction.accountAssignments || []).map(aa => ({
                        AccountNo: aa.account,
                        TaxCode: aa.taxCode,
                        Text: aa.text,
                        Credit: aa.credit,
                        Debit: aa.debit,
                    })),
                },
            },
        };

        const response = await this.apiCall('Save', body);
        log.info({response}, 'created transaction in diamant');

        return response.key;
    }
}

module.exports = {
    TransactionService,
};
