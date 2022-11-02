'use strict';

const { formatISO, parseISO } = require("date-fns");
const { zonedTimeToUtc } = require('date-fns-tz');

function formatISODate(date) {
    return formatISO(date, { representation: 'date' });
}

function parseISOUTC(dateString) {
    return zonedTimeToUtc(parseISO(dateString), 'UTC');
}

function parseDate(dateString) {
    const date = new Date(dateString);

    if (date.toString() === 'Invalid Date') {
        throw `Invalid date '${dateString}'`;
    }

    return date;
}

module.exports = {
    formatISODate,
    parseISOUTC,
    parseDate,
};
