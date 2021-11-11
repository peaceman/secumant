exports.up = async function(knex) {
    await knex.schema.alterTable('diamant_transactions', table => {
        table.string('cost_object', 16)
            .nullable()
            .after('cost_center');
    });
};

exports.down = function(knex) {

};
