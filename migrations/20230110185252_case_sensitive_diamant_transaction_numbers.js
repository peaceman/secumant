exports.up = async function(knex) {
    await knex.schema.alterTable('diamant_transactions', table => {
        table.string('number', 15)
            .notNullable()
            .collate('utf8mb4_bin')
            .alter();
    });
};

exports.down = function(knex) {

};
