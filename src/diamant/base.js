'use strict';

const log = require('../log');
const { ApiResultError } = require('./api');
const { apiCall } = require('../util/soap');
const { trimStart, trimEnd } = require('lodash');

class BaseService {
    /**
     *
     * @param {import('.').ApiConfig} apiConfig
     * @param {import('.').SoapClientFactory} soapClientFactory
     */
    constructor(apiConfig, soapClientFactory) {
        /** @type {import('.').ApiConfig} */
        this.apiConfig = apiConfig;
        /** @type {import('.').SoapClientFactory} */
        this.soapClientFactory = soapClientFactory;
        /** @type {soap.Client|null} */
        this.soapClient = null;
    }

    get serviceWsdlPath() {
        throw new Error('not implemented');
    }

    async getSoapClient() {
        if (!this.soapClient) {
            const wsdlUrl = `${trimEnd(this.apiConfig.baseUrl, '/')}/${trimStart(this.serviceWsdlPath, '/')}`;
            this.soapClient = await this.soapClientFactory(wsdlUrl);
        }

        return this.soapClient;
    }

    async apiCall(method, body = {}) {
        const soapClient = await this.getSoapClient();
        const response = await apiCall(soapClient, method, body);

        if (!response.result.SaveResult) {
            log.error(
                {method, body, response},
                'Unexpected diamant api response',
            );

            throw new ApiResultError('Got non success api result', response);
        }

        return response.result;
    }

}

module.exports = {
    BaseService,
};
