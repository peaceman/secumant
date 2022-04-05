'use strict';

const log = require("../log");
const nodemailer = require("nodemailer");
const { DiamantTransaction } = require("../database/models");
const { subDays, format } = require("date-fns");
const { formatISODate } = require("../util");
const stream = require("stream");
const csv = require("csv");
const { mkdtemp } = require("fs/promises");
const path = require("path");
const os = require("os");
const fs = require("fs");

/**
 * @typedef {Object} ReportDiamantTransactionsConfig
 * @property {string} sender
 * @property {string[]} recipients
 */

class ReportDiamantTransactions {
    /**
     * @param {ReportDiamantTransactionsConfig} config
     * @param {nodemailer.Transporter} mailer
     * @param {AsyncIterable<DiamantTransaction>} transactionsProvider
     */
    constructor(config, mailer, transactionsProvider = fetchReportableTransactions) {
        this.config = config;
        this.mailer = mailer;
        /** @type {AsyncIterable<DiamantTransaction>} */
        this.provider = transactionsProvider;
    }

    async execute() {
        log.info("Start reporting diamant transactions");

        const csvStream = stream.Readable
            .from(this.provider())
            .pipe(csv.transform(record => {
                const { secutixLineItems, ...rec } = record;

                return {
                    ...rec,
                    sourceLineIds: (secutixLineItems || [])
                        .map(li => li.id)
                        .join(', '),
                };
            }))
            .pipe(csv.stringify({ header: true, cast: { date: v => v.toISOString() } }));

        await this.mailer.sendMail({
            from: this.config.sender,
            to: this.config.recipients,
            subject: "Diamant Transactions Reporting",
            attachments: [{
                filename: `diamant-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`,
                content: csvStream,
            }],
        });

        log.info("Finished reporting diamant transactions");
    }
}

/**
 * @yields {DiamantTransaction}
 */
async function* fetchReportableTransactions() {
    let page = 0;

    const today = new Date();
    const lastReportingDay = subDays(today, 7);

    while (true) {
        const query = DiamantTransaction.query()
            .withGraphFetched("secutixLineItems")
            .whereRaw('date(created_at) >= ?', formatISODate(lastReportingDay))
            .whereRaw('date(created_at) < ?', formatISODate(today))
            .orderBy('id', 'desc')
            .page(page, 100);

        const result = await query;
        const transactions = result.results;
        yield* transactions;

        if (transactions.length === 0) {
            return;
        }

        page += 1;
    }
}

module.exports = {
    ReportDiamantTransactions,
    fetchReportableTransactions,
};
