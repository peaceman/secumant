
exports.up = async function (knex) {
    await knex.schema.alterTable('diamant_transactions', table => {
        table.enu('direction', ['P', 'S'])
            .notNullable()
            .after('number');

        table.string('ledger_account')
            .notNullable()
            .after('direction');
    });
};

exports.down = function(knex) {

};
