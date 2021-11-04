
exports.up = async function (knex) {
    await knex.schema.createTable('diamant_transactions', table => {
        table.bigIncrements('id');

        table.date('reference_date')
            .notNullable();

        table.string('document_type', 4)
            .notNullable();

        table.string('number', 15)
            .notNullable();

        table.integer('vat_rate')
            .unsigned()
            .nullable();

        table.bigInteger('amount')
            .unsigned()
            .notNullable();

        table.bigInteger('key')
            .unsigned()
            .nullable()
            .comment('diamant tx key');

        table.timestamp('created_at')
            .notNullable()
            .defaultTo(knex.fn.now());

        table.index(['reference_date'], 'dt_idx_rd');
        table.index(['key'], 'dt_idx_key');
        table.unique(['number'], 'dt_uniq_n');
    });
};

exports.down = function (knex) {

};
