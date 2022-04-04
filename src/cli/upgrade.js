'use strict';

const log = require('../log');
const { withSentry } = require("../sentry");

exports.command = 'upgrade';
exports.desc = 'upgrades the database schema';
exports.handler = withSentry(async argv => {
    const { knex } = require('../database');

    try {
        log.info('Start database migrations');
        await knex.migrate.latest();
        log.info('Finished database migrations');
    } catch (err) {
        log.error(err, 'Failed to migrate the database');
    }

    // required to let the cli command finish
    await knex.destroy();
});
