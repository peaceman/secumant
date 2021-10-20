'use strict';

const ApiResponseStatus = Object.freeze({
    SUCCESS: 'success',
    IN_PROGRESS: 'in_progress',
});

class ApiResultError extends Error {
    /**
     * @param {string} message
     * @param {import('../util/soap').SoapResponse} soapResponse
     */
    constructor(message, soapResponse) {
        super(message);
        this.name = 'SecuTix API Result Error';
        /** @type {import('../util/soap').SoapResponse} */
        this.soapResponse = soapResponse;
    }
}

module.exports = {
    ApiResponseStatus,
    ApiResultError,
};
