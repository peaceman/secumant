'use strict';

class ApiResultError extends Error {
    /**
     * @param {string} message
     * @param {import('../util/soap').SoapResponse} soapResponse
     */
    constructor(message, soapResponse) {
        super(message);

        this.name = 'Diamant API Result Error';
        this.soapResponse = soapResponse;
    }
}

module.exports = {
    ApiResultError,
};
