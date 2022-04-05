'use strict';

const config = require('config');
const nodemailer = require("nodemailer");
const { transactionService } = require("../diamant");
const { ExportDiamantTransactions } = require("./export-diamant-transactions");
const { ReportDiamantTransactions } = require('./report-diamant-transactions');

const exportDiamantTransactions = new ExportDiamantTransactions(
    {
        clearingAccount: config.get('aggregation.clearingAccount'),
        taxCodeMapping: config.get('aggregation.taxCodeMapping'),
        postingPeriodOverrides: config.get('aggregation.postingPeriodOverrides'),
    },
    transactionService,
);

const mailerTransport = nodemailer.createTransport(config.get("mail.smtp"));

const reportDiamantTransactions = new ReportDiamantTransactions(
    {
        sender: config.get("mail.sender"),
        recipients: config.get("reporting.recipients"),
    },
    mailerTransport,
);

module.exports = {
    exportDiamantTransactions,
    reportDiamantTransactions,
};
