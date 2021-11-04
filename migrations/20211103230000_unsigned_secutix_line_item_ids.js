
exports.up = async function (knex) {
    await knex.schema.alterTable('secutix_line_items', table => {
        table.bigInteger('id')
            .unsigned()
            .notNullable()
            .alter();
    });
};

exports.down = function (knex) {

};
