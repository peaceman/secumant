'use strict';

const { default: axios } = require('axios');
const config = require('config');
const apiConfig = config.get('diamant');
const soap = require('soap');

async function createSoapClient(wsdlUrl) {
    const httpClient = createHttpClient();

    return await soap.createClientAsync(wsdlUrl, {
        request: httpClient,
    });
}

function createHttpClient() {
    if (!apiConfig.httpProxy.host)
        return undefined;

    return axios.create({
        proxy: apiConfig.httpProxy,
        timeout: 5000,
    });
}

module.exports = {
    createSoapClient,
};
