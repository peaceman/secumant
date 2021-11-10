
exports.up = async function (knex) {
    await knex.schema.alterTable('diamant_transactions', table => {
        table.string('cost_center', 8)
            .nullable()
            .after('vat_rate');
    });
};

exports.down = function(knex) {

};
