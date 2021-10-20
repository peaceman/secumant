'use strict';

const { trimEnd, trimStart } = require('lodash');
const soap = require('soap');
const { apiCall } = require('../util/soap');
const log = require('../log');
const { ApiResponseStatus, ApiResultError } = require('./api');

const SERVICE_URL_PATH = '/tnai/external-remoting/com.secutix.service.export.v1_0.DataExportService.webservice?wsdl';

class DataExportService {
    /**
     * @param {ApiConfig} apiConfig
     */
    constructor(apiConfig) {
        /** @type {ApiConfig} */
        this.apiConfig = apiConfig;
    }

    async apiCall(method, resultKey, body = {}) {
        const soapClient = await this.getSoapClient();
        let requestId = undefined;

        // TODO add throttling, secutix allows 1 request per second per method/endpoint
        while (true) {
            const response = await apiCall(soapClient, method, {...body, requestId});
            const result = response.result[resultKey];

            if (!result) {
                log.error(
                    {method, resultKey, body, response},
                    'Unexpected secutix api response'
                );

                throw new ApiResultError('Missing result key in api result', response);
            }

            if (result.statusCode === ApiResponseStatus.SUCCESS) {
                return result;
            }

            if (result.statusCode === ApiResponseStatus.IN_PROGRESS) {
                requestId = result.requestId;

                if (!requestId) {
                    log.warn(
                        {method, resultKey, body, response},
                        'Missing request id in in_progress secutix response'
                    );

                    continue;
                }
            }

            log.error(
                {method, resultKey, body, response},
                'Unexpected secutix api response'
            );

            throw new ApiResultError('Got non success api result', response);
        }
    }

    async getAvailableExports() {
        const result = await this.apiCall(
            'getAvailableExports',
            'AvailableExportsResult'
        );

        return result.exports;
    }

    async executeExport(queryKey, dateFrom, { maxResults = 100 } = {}) {
        const result = await this.apiCall(
            'executeExport',
            'ExportResult',
            {
                exportKey: queryKey,
                dateFrom: dateFrom.toISOString(),
                nbMaxResults: maxResults,
            }
        );

        return {
            exportDate: result.exportDate,
            elements: transformExportedElements(result.exportedElements || []),
        };
    }

    async flagItems(elementIds, { flagDate = new Date() } = {}) {
       const result = await this.apiCall('flagItems', 'FlagItems', {
            elementsIds: elementIds,
            itemKind: 'GENERIC',
            flagDate: flagDate.toISOString(),
        });

        return result;
    }

    async unflagItems(elementIds) {
        const result = await this.apiCall('unFlagItems', 'UnFlagItems', {
            elementsIds: elementIds,
            itemKind: 'GENERIC',
        });

        return result;
    }

    async getFlaggingStatus(elementIds) {
        const result = await this.apiCall('getFlaggingStatus', 'GetFlaggingStatus', {
            itemKind: 'GENERIC',
            elementsIds: elementIds,
        });

        return result;
    }

    /**
     * @returns {soap.Client}
     */
    async getSoapClient() {
        if (!this.soapClient) {
            const wsdlUrl = `${trimEnd(this.apiConfig.baseUrl, '/')}/${trimStart(SERVICE_URL_PATH)}`;
            const client = await soap.createClientAsync(wsdlUrl);

            configureSoapSecurity(client, this.apiConfig);

            this.soapClient = client;
        }

        return this.soapClient;
    }
}

/**
 * @param {soap.Client} soapClient
 * @param {ApiConfig} apiConfig
 */
function configureSoapSecurity(soapClient, apiConfig) {
    const security = new soap.WSSecurity(
        apiConfig.auth.username,
        apiConfig.auth.password,
    );

    soapClient.setSecurity(security);
}

function transformExportedElements(elements) {
    return elements
        .map(el => el.nameValues
            .reduce((prev, {name, value}) => {
                return {...prev, [name]: value};
            }, {})
        );
}

module.exports = {
    DataExportService,
};
