'use strict';

const log = require("../log");

/**
 * @typedef {Object} SoapResponse
 * @property {object} result
 * @property {string} rawResponse
 * @property {object} soapHeader
 * @property {string} rawRequest
 */

async function packSoapResponse(responsePromise) {
    const [result, rawResponse, soapHeader, rawRequest] = await responsePromise;

    return {
        result,
        rawResponse,
        soapHeader,
        rawRequest,
    };
}

async function apiCall(soapClient, method, ...args) {
    try {
        return await packSoapResponse(soapClient[`${method}Async`](...args));
    } catch (err) {
        log.error(err, 'Failed API-Call "%s"', method);

        throw err;
    }
}

module.exports = {
    packSoapResponse,
    apiCall,
};
