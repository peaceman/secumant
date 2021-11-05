'use strict';

const { differenceInMinutes } = require("date-fns");
const { BaseService } = require("./base");

const SERVICE_WSDL_PATH = '/WS1Login/SessionService.asmx?wsdl'

/**
 * @typedef {Object} SessionKeyCache
 * @property {Date} createdAt
 * @property {string} key
 */

class SessionService extends BaseService {
    /**
     * @param {import('.').ApiConfig} apiConfig
     * @param {import('.').SoapClientFactory} soapClientFactory
     */
    constructor(apiConfig, soapClientFactory) {
        super(apiConfig, soapClientFactory);

        /** @type {SessionKeyCache|null} **/
        this.sessionKeyCache = null;
    }

    get serviceWsdlPath() {
        return SERVICE_WSDL_PATH;
    }

    /**
     * @returns {Promise<string>} session key
     */
    async getSessionKey() {
        const key = this.fetchSessionKeyFromCache();
        if (key !== null) return key;

        const result = await this.apiCall('Save', {
            data: {
                User: this.apiConfig.auth.username,
                Password: this.apiConfig.auth.password,
                Company: this.apiConfig.auth.tenant,
            },
        });

        this.sessionKeyCache = createSessionKeyCache(result.key);

        return result.key;
    }

    /**
     * @returns {string|null} session key
     */
    fetchSessionKeyFromCache() {
        if (this.sessionKeyCache === null) return null;

        // ensure limited cache lifetime
        if (differenceInMinutes(new Date(), this.sessionKeyCache.createdAt) >= 30) {
            this.sessionKeyCache = null;

            return null;
        }

        return this.sessionKeyCache.key;
    }
}

/**
 * @param {string} sessionKey
 * @returns {SessionKeyCache}
 */
function createSessionKeyCache(sessionKey) {
    return Object.freeze({
        createdAt: new Date(),
        key: sessionKey,
    });
}

module.exports = {
    SessionService,
}
