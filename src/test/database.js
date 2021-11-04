const Knex = require('knex');
const config = require('config');
const crypto = require('crypto');

const knexConfig = require('../../knexfile');

function openConnection(databaseName = undefined) {
    return Knex({
        ...knexConfig,
        connection: {
            ...knexConfig.connection,
            database: databaseName,
        },
    });
}

async function createDatabase() {
    const databaseName = `${config.get('database.name')}_${process.env.JEST_WORKER_ID}_${getRndDbNameSuffix()}`;
    let knex = openConnection();

    console.log(`creating database ${databaseName}, dropping if it already exists`);
    await knex.raw(`drop database if exists \`${databaseName}\``);
    await knex.raw(`create database \`${databaseName}\``);
    await knex.destroy()

    knex = openConnection(databaseName);
    console.log(`migrating database ${databaseName}`);
    await knex.migrate.latest();

    return {name: databaseName, knex};
}

async function dropDatabase({name: databaseName, knex}) {
    console.log(`dropping database ${databaseName}`);
    await knex.raw(`drop database\`${databaseName}\``);
    await knex.destroy();
}

async function truncateDatabase({name: databaseName, knex}) {
    const tables = await fetchTableNames(knex);

    await knex.raw('set foreign_key_checks = 0');

    for (const table of tables.filter(n => !n.startsWith('knex'))) {
        await knex.raw(`truncate table \`${table}\``);
    }

    await knex.raw('set foreign_key_checks = 1');
}

async function fetchTableNames(knex) {
    const tables = await knex.raw('show tables');

    return (tables[0] || [])
        .map(row => Object.values(row))
        .flat();
}

function getRndDbNameSuffix() {
    return crypto.randomBytes(2)
        .toString('hex');
}

module.exports = {
    createDatabase,
    dropDatabase,
    truncateDatabase,
};
