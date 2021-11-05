'use strict';

const config = require('config');

const { SessionService } = require('./session');
const { createSoapClient } = require('./soap');
const { TransactionService } = require('./transaction');

/**
 * @typedef {Object} ApiConfig
 * @property {string} baseUrl
 * @property {ApiConfigAuth} auth
 * @property {ApiConfigProxy} httpProxy
 */

/**
 * @typedef {Object} ApiConfigAuth
 * @property {string} username
 * @property {string} password
 * @property {string} tenant
 */

/**
 * @typedef {Object} ApiConfigProxy
 * @property {string} protocol
 * @property {string} host
 * @property {number} port
 * @property {ApiConfigProxyAuth} auth
 */

/**
 * @typedef {Object} ApiConfigProxyAuth
 * @property {string} username
 * @property {string} password
 */

/**
 * @typedef {function} SoapClientFactory
 * @param {string} wsdlUrl
 * @returns {Promise<soap.Client>}
 */

const sessionService = new SessionService(config.get('diamant'), createSoapClient);
const transactionService = new TransactionService(
    config.get('diamant'),
    createSoapClient,
    sessionService,
);

module.exports = {
    sessionService,
    transactionService,
};
