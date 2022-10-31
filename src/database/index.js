'use strict';

const Knex = require('knex');
const { Model } = require('objection');
const knexConfig = require('../../knexfile');
const log = require('../log');

const knex = Knex({
    ...knexConfig,
    pool: {
        afterCreate: (conn, done) => {
            log.info({
                dbConnection: {
                    host: conn?.config?.host,
                    port: conn?.config?.port,
                    socketPath: conn?.config?.socketPath,
                },
            }, 'Established new database connection');

            done(false, conn);
        },
        min: 0,
    },
});

Model.knex(knex);

module.exports = {
    knex,
};
