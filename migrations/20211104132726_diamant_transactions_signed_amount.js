
exports.up = async function (knex) {
    await knex.schema.alterTable('diamant_transactions', table => {
        table.bigInteger('amount')
            .notNullable()
            .alter();
    });
};

exports.down = function(knex) {

};
