
exports.up = async function (knex) {
    await knex.schema.createTable('diamant_transaction_sources', table => {
        table.bigInteger('diamant_transaction_id')
            .notNullable()
            .unsigned();

        table.bigInteger('secutix_line_item_id')
            .notNullable()
            .unsigned();

        table.foreign('diamant_transaction_id', 'dts_fk_dti')
            .references('id')
            .inTable('diamant_transactions')
            .onDelete('cascade')
            .onUpdate('cascade');

        table.foreign('secutix_line_item_id', 'dts_fk_slii')
            .references('id')
            .inTable('secutix_line_items')
            .onDelete('restrict')
            .onUpdate('cascade');

        table.timestamp('created_at')
            .notNullable()
            .defaultTo(knex.fn.now());

        table.primary(['diamant_transaction_id', 'secutix_line_item_id']);
    });
};

exports.down = function(knex) {

};
