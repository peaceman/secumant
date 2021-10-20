'use strict';

const config = require('config');
const { DataExportService } = require("./data-export");

/**
 * @typedef {Object} ApiConfig
 * @property {string} baseUrl
 * @property {ApiConfigAuth} auth
 * @property {string} exportQuery
 */

/**
 * @typedef {Object} ApiConfigAuth
 * @property {string} username
 * @property {string} password
 */


const dataExportService = new DataExportService(config.get('secutix'));

module.exports = {
    dataExportService,
};
