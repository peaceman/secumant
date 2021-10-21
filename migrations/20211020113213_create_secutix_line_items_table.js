exports.up = async function (knex) {
    await knex.schema.createTable('secutix_line_items', table => {
        table.bigInteger('id')
            .notNullable()
            .primary();

        table.date('reference_date')
            .notNullable();

        table.json('data')
            .notNullable();

        table.datetime('flagged_at')
            .nullable();

        table.timestamp('created_at')
            .defaultTo(knex.fn.now());

        table.index(['reference_date'], 'sli_idx_rd');
        table.index(['flagged_at'], 'sli_idx_fa')
    });
};

exports.down = function (knex) {

};
