'use strict';

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
