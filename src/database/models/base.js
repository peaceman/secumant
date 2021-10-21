'use strict';

const { parseISO, formatISO9075 } = require('date-fns');
const { Model, snakeCaseMappers } = require('objection');
const { knex } = require('..');

Model.knex(knex);

class BaseModel extends Model {
    static get columnNameMappers() {
        return snakeCaseMappers();
    }

    static get useLimitInFirst() {
        return true;
    }

    $beforeInsert() {
        this.createdAt = new Date();
    }

    $formatDatabaseJson(json) {
        const properties = this.constructor.jsonSchema?.properties || [];

        for (const [propName, propSettings] of Object.entries(properties)) {
            const propTypes = Array.isArray(propSettings.type)
                ? propSettings.type
                : [propSettings.type];

            if (propTypes.includes('string')
                && propSettings.format === 'date-time'
                && json[propName] !== undefined)
            {
                const date = parseISO(json[propName]);
                json[propName] = formatISO9075(date);
            }
        }

        return super.$formatDatabaseJson(json);
    }
}

module.exports = BaseModel;
