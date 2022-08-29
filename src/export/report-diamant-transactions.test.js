'use strict';

const { subDays } = require("date-fns");
const { createDatabase, dropDatabase, truncateDatabase } = require("../test/database");
const { Model } = require("objection");
const MockDate = require("mockdate");
const { DiamantTransaction } = require("../database/models");
const { formatISODate } = require("../util");
const { fetchReportableTransactions, ReportDiamantTransactions } = require("./report-diamant-transactions");
const stream = require("stream");
const csv = require('csv');

describe('report diamant transactions', () => {
    let db;

    const now = new Date('2022-04-04');

    beforeAll(async () => {
        db = await createDatabase();
        Model.knex(db.knex);
    });

    afterAll(async () => {
        await dropDatabase(db);
    });

    afterEach(async () => {
        await truncateDatabase(db);
        MockDate.reset();
    });

    function setupMailer() {
        return {
            sendMail: jest.fn(),
        };
    }

    it('sends email with transactions as attachment', async () => {
        const txBase = {
            referenceDate: formatISODate(new Date()),
            documentType: 'ABCD',
            direction: 'P',
            ledgerAccount: 23,
            number: 'TX NR LEL',
            amount: 2300,
        };

        const transactions = function* () { yield* [
            DiamantTransaction.fromJson({
                ...txBase,
                number: 'TX NR L1',
            }),
            DiamantTransaction.fromJson({
                ...txBase,
                number: 'TX NR L2',
            }),
        ]};

        const mailer = setupMailer();

        const reporterConfig = { recipients: ['foo@example.com'] };
        const reporter = new ReportDiamantTransactions(
            reporterConfig,
            mailer,
            transactions,
        );

        await reporter.execute();
        expect(mailer.sendMail).toHaveBeenCalledTimes(1);

        const [mailData] = mailer.sendMail.mock.lastCall;
        expect(mailData).toMatchObject({
            to: reporterConfig.recipients,
        });
        expect(mailData.attachments).toHaveLength(1);

        const attachment = mailData.attachments[0];
        expect(attachment).toBeDefined();

        const records = await asyncCollect(attachment.content.pipe(csv.parse({ columns: true })));
        expect(records.length).toEqual(2);
        expect(records).toPartiallyContain({ number: 'TX NR L1' });
        expect(records).toPartiallyContain({ number: 'TX NR L2' });
    });

    async function asyncCollect(iter) {
        const data = [];

        for await (const v of iter) {
            data.push(v);
        }

        return data;
    }

    describe('reportable diamant transactions provider', () => {
        it('includes transactions of the last reporting day', async () => {
            MockDate.set(now);
            const dayOfPreviousReport = subDays(now, 7);

            await DiamantTransaction.query()
                .insert({
                    referenceDate: formatISODate(new Date()),
                    documentType: 'ABCD',
                    direction: 'P',
                    ledgerAccount: 23,
                    number: 'TX NR LEL',
                    amount: 2300,
                    key: '4',
                    createdAt: dayOfPreviousReport,
                });

            const txs = [];
            for await (const tx of fetchReportableTransactions({
                from: dayOfPreviousReport,
                until: now,
            })) {
                txs.push(tx);
            }

            expect(txs.map(tx => tx.key)).toEqual(["4"]);
        });

        it('excludes transactions of the current reporting day', async () => {
            MockDate.set(now);

            const tx = await DiamantTransaction.query()
                .insert({
                    referenceDate: formatISODate(new Date()),
                    documentType: 'ABCD',
                    direction: 'P',
                    ledgerAccount: 23,
                    number: 'TX NR LEL',
                    amount: 2300,
                    key: '4',
                    createdAt: now,
                });

            const txs = [];
            for await (const tx of fetchReportableTransactions({
                from: subDays(now, 7),
                until: now,
            })) {
                txs.push(tx);
            }

            expect(txs.map(tx => tx.key)).not.toEqual(expect.arrayContaining(["4"]));
        });
    });
});
