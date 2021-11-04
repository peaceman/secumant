
exports.up = async function(knex) {
    await knex.schema.alterTable('secutix_line_items', table => {
        table.datetime('processed_at')
            .nullable();

        table.index(['processed_at'], 'sli_idx_pa');
    });
};

exports.down = function(knex) {

};
