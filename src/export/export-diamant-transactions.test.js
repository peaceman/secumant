'use strict';

const { Model } = require('objection');
const MockDate = require('mockdate');
const { createDatabase, dropDatabase, truncateDatabase } = require('../test/database');
const { DiamantTransaction } = require('../database/models/diamant-transaction');
const { formatISODate, parseISOUTC } = require('../util');
const { ExportDiamantTransactions } = require('./export-diamant-transactions');
const { parseISO, subDays, addDays } = require('date-fns');

describe('export diamant transactions', () => {
    let db;

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

    function setupTransactionService() {
        return {
            create: jest.fn(),
        };
    }

    const exportConfig = {
        clearingAccount: '2342',
        taxCodeMapping: {
            19000: 5,
        },
    };

    it('ignores already exported transactions', async () => {
        await DiamantTransaction.query()
            .insert({
                referenceDate: formatISODate(new Date()),
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'TX NR LEL',
                amount: 2300,
                key: '4',
            });

        const transactionService = setupTransactionService();
        const exportDiamantTransactions = new ExportDiamantTransactions(
            exportConfig,
            transactionService,
        );

        await exportDiamantTransactions.execute();

        expect(transactionService.create).not.toHaveBeenCalled();
    });

    it('only exports transactions between the given dates', async () => {
        const startDate = new Date('2021-05-23');
        const endDate = new Date('2021-05-28');

        await DiamantTransaction.query()
            .insert({
                referenceDate: formatISODate(subDays(startDate, 1)),
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'TX NR before',
                amount: 2300,
            });

        await DiamantTransaction.query()
            .insert({
                referenceDate: formatISODate(addDays(endDate, 1)),
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'TX NR after',
                amount: 2300,
            });

        await DiamantTransaction.query()
            .insert({
                referenceDate: formatISODate(startDate),
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'TX NR between',
                amount: 2300,
            });

        const transactionService = setupTransactionService();
        const exportDiamantTransactions = new ExportDiamantTransactions(
            exportConfig,
            transactionService,
        );

        await exportDiamantTransactions.execute({startDate, endDate});

        expect(transactionService.create).toHaveBeenCalledTimes(1);
        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'TX NR between',
        }));
    });

    it('exports transactions', async () => {
        const refDate = formatISODate(new Date());

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'A',
                amount: 2300,
            });

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'S',
                ledgerAccount: 23,
                number: 'B',
                amount: 2300,
            });

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'S',
                ledgerAccount: 23,
                number: 'C',
                amount: 2300,
                vatRate: 19000,
            });

        const transactionService = setupTransactionService();
        const exportDiamantTransactions = new ExportDiamantTransactions(
            exportConfig,
            transactionService,
        );

        transactionService.create.mockResolvedValueOnce('2301');
        transactionService.create.mockResolvedValueOnce('2302');
        transactionService.create.mockResolvedValueOnce('2303');

        await exportDiamantTransactions.execute();

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'A',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: String(23),
                    debit: 23,
                    taxCode: undefined,
                },
                {
                    account: String(exportConfig.clearingAccount),
                    credit: 23,
                    taxCode: undefined,
                },
            ]
        }));

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'B',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: exportConfig.clearingAccount,
                    debit: 23,
                },
                {
                    account: String(23),
                    credit: 23,
                },
            ]
        }));

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'C',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: exportConfig.clearingAccount,
                    debit: 23,
                },
                {
                    account: String(23),
                    credit: 23,
                    taxCode: 5,
                },
            ]
        }));

        const txs = [
            { number: 'A', key: '2301' },
            { number: 'B', key: '2302' },
            { number: 'C', key: '2303' },
        ];

        for (const tx of txs) {
            const dbTx = await DiamantTransaction.query()
                .where({number: tx.number})
                .first();

            expect(dbTx.key).toEqual(tx.key);
        }
    });

    it('exports with cost center and cost object', async () => {
        const refDate = formatISODate(new Date());

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'A',
                amount: 2300,
                costCenter: 'LEL',
                costObject: 'LUL',
            });

        const transactionService = setupTransactionService();
        const exportDiamantTransactions = new ExportDiamantTransactions(
            exportConfig,
            transactionService,
        );

        transactionService.create.mockResolvedValueOnce('2302');

        await exportDiamantTransactions.execute();

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'A',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: String(23),
                    debit: 23,
                    taxCode: undefined,
                    costCenter: 'LEL',
                    costObject: 'LUL',
                },
                {
                    account: String(exportConfig.clearingAccount),
                    credit: 23,
                    taxCode: undefined,
                    costCenter: undefined,
                    costObject: undefined,
                },
            ],
        }));
    });

    it('exports with overriden posting period', async () => {
        const refDate = formatISODate(new Date());
        const overrideDates = {
            start: new Date('2021-11-12'),
            end: new Date('2021-11-15'),
        };
        const overridePostingPeriod = '23.2032';

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'A',
                amount: 2300,
                costCenter: 'LEL',
                costObject: 'LUL',
            });

        await DiamantTransaction.query()
            .insert({
                referenceDate: formatISODate(overrideDates.start),
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'B',
                amount: 2300,
                costCenter: 'LEL',
                costObject: 'LUL',
            });

        const transactionService = setupTransactionService();
        const exportDiamantTransactions = new ExportDiamantTransactions(
            {
                ...exportConfig,
                postingPeriodOverrides: [
                    {
                        startDate: formatISODate(overrideDates.start),
                        endDate: formatISODate(overrideDates.end),
                        postingPeriod: overridePostingPeriod,
                    },
                ],
            },
            transactionService,
        );

        transactionService.create.mockResolvedValueOnce('2302');

        await exportDiamantTransactions.execute();

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'A',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: String(23),
                    debit: 23,
                    taxCode: undefined,
                    costCenter: 'LEL',
                    costObject: 'LUL',
                },
                {
                    account: String(exportConfig.clearingAccount),
                    credit: 23,
                    taxCode: undefined,
                    costCenter: undefined,
                    costObject: undefined,
                },
            ],
        }));

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'B',
            type: 'ABCD',
            date: overrideDates.start,
            postingPeriod: overridePostingPeriod,
            accountAssignments: [
                {
                    account: String(23),
                    debit: 23,
                    taxCode: undefined,
                    costCenter: 'LEL',
                    costObject: 'LUL',
                },
                {
                    account: String(exportConfig.clearingAccount),
                    credit: 23,
                    taxCode: undefined,
                    costCenter: undefined,
                    costObject: undefined,
                },
            ],
        }));
    });

    it('continues exporting if a single transaction fails', async () => {
        const refDate = formatISODate(new Date());

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'P',
                ledgerAccount: 23,
                number: 'A',
                amount: 2300,
            });

        await DiamantTransaction.query()
            .insert({
                referenceDate: refDate,
                documentType: 'ABCD',
                direction: 'S',
                ledgerAccount: 23,
                number: 'B',
                amount: 2300,
            });

        const transactionService = setupTransactionService();
        const exportDiamantTransactions = new ExportDiamantTransactions(
            exportConfig,
            transactionService,
        );

        transactionService.create.mockImplementationOnce(() => {
            throw 'dis is error';
        });

        transactionService.create.mockResolvedValueOnce('2302');

        await exportDiamantTransactions.execute();

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'A',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: String(23),
                    debit: 23,
                    taxCode: undefined,
                },
                {
                    account: String(exportConfig.clearingAccount),
                    credit: 23,
                    taxCode: undefined,
                },
            ]
        }));

        expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
            number: 'B',
            type: 'ABCD',
            date: parseISOUTC(refDate),
            accountAssignments: [
                {
                    account: exportConfig.clearingAccount,
                    debit: 23,
                },
                {
                    account: String(23),
                    credit: 23,
                },
            ]
        }));

        const txs = [
            { number: 'B', key: '2302' },
        ];

        for (const tx of txs) {
            const dbTx = await DiamantTransaction.query()
                .where({number: tx.number})
                .first();

            expect(dbTx.key).toEqual(tx.key);
        }
    });
});
