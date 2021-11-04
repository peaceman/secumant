'use strict';

const { formatISO, parseISO } = require("date-fns");
const { zonedTimeToUtc } = require('date-fns-tz');

function formatISODate(date) {
    return formatISO(date, { representation: 'date' });
}

function parseISOUTC(dateString) {
    return zonedTimeToUtc(parseISO(dateString), 'UTC');
}


module.exports = {
    formatISODate,
    parseISOUTC,
};
