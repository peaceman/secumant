'use strict';

const { formatISO, parseISO } = require('date-fns');
const DiamantTransactionModel = require('../database/models/diamant-transaction');
const genRandomDiamantTransactionNumberSuffix = jest.spyOn(
    DiamantTransactionModel,
    'genRandomDiamantTransactionNumberSuffix'
);

const { SecutixLineItem } = require('../database/models');
const { createDatabase, dropDatabase, truncateDatabase } = require('../test/database');
const { Model } = require('objection');
const MockDate = require('mockdate');
const { ProcessSecutixLineItems } = require('./process-secutix-line-items');
const { formatISODate, parseISOUTC } = require('../util');
const log = require('../log');

describe('process secutix line items', () => {
    let db;

    const processableDate = new Date('2021-10-31');
    const unprocessableDate = new Date('2021-11-04');
    const now = new Date('2021-11-04');

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

    function setupSecutixLineAggregator() {
        return {
            getAggregatedRecords: jest.fn().mockReturnValue([]),
            feedLineItem: jest.fn(),
        };
    }

    it('ignores line items that are newer than the day before processing', async () => {
        MockDate.set(now);

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(unprocessableDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const process = new ProcessSecutixLineItems(lineAggregator);

        await process.execute();

        expect(lineAggregator.feedLineItem).not.toHaveBeenCalled();
    });

    it('ignores already processed line items', async () => {
        MockDate.set(now);

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(processableDate),
                data: {},
                processedAt: new Date().toISOString(),
            });

        const lineAggregator = setupSecutixLineAggregator();
        const process = new ProcessSecutixLineItems(lineAggregator);

        await process.execute();

        expect(lineAggregator.feedLineItem).not.toHaveBeenCalled();
    });

    it('processes unprocessed line items that are older than the day of processing', async () => {
        MockDate.set(now);

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(processableDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const process = new ProcessSecutixLineItems(lineAggregator);

        await process.execute();

        expect(lineAggregator.feedLineItem)
            .toHaveBeenCalledWith(expect.objectContaining({id: '1234'}));
    });

    it('processed unprocessed line items that are older than the configured date', async () => {
        const processableDate = new Date('2022-10-31');

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(processableDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const process = new ProcessSecutixLineItems(lineAggregator);

        await process.execute({ untilReferenceDateIncluding: processableDate });

        expect(lineAggregator.feedLineItem)
            .toHaveBeenCalledWith(expect.objectContaining({id: '1234'}));
    });

    it('doesnt aggregate composed products', async () => {
        MockDate.set(now);

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(processableDate),
                data: {
                    kind: 'COMPOSED_PRODUCT',
                },
            });

        const lineAggregator = setupSecutixLineAggregator();
        const process = new ProcessSecutixLineItems(lineAggregator);

        await process.execute();

        expect(lineAggregator.feedLineItem)
            .not.toHaveBeenCalled();
    });

    it('stores aggregated records as diamant transactions', async () => {
        const referenceDate = new Date('2021-11-04');

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        await SecutixLineItem.query()
            .insert({
                id: '12345',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(referenceDate),
            groupingKey: 'WTS GK',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: 23000,
            vatRate: undefined,
            sourceLineIds: ['1234', '12345'],
            costCenter: 'LEL',
            costObject: 'LUL',
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
        ]);


        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        const li = await SecutixLineItem.query().findById('1234');
        const tx = await li.$relatedQuery('diamantTransaction');

        expect(tx).toBeDefined();
        expect(tx).toMatchObject({
            number: expect.stringContaining(aggregationLineItem.groupingKey),
            documentType: aggregationLineItem.documentType,
            referenceDate: parseISOUTC(aggregationLineItem.referenceDate),
            ledgerAccount: aggregationLineItem.ledgerAccount,
            direction: aggregationLineItem.paymentSale,
            vatRate: null,
            amount: String(aggregationLineItem.amount),
            costCenter: aggregationLineItem.costCenter,
            costObject: aggregationLineItem.costObject,
        });
    });

    it('doesnt store aggregated records with an amount of 0', async () => {
        const referenceDate = new Date('2021-11-04');
        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(referenceDate),
            groupingKey: 'WTS GK',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: 0,
            vatRate: undefined,
            sourceLineIds: ['1234'],
            costCenter: 'LEL',
            costObject: 'LUL',
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
        ]);

        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        const li = await SecutixLineItem.query().findById('1234');
        const tx = await li.$relatedQuery('diamantTransaction');

        expect(tx).not.toBeDefined();
    });

    it('stores aggregated records with an amount of less than 0', async () => {
        const referenceDate = new Date('2021-11-04');
        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(referenceDate),
            groupingKey: 'WTS GK',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: -1000,
            vatRate: undefined,
            sourceLineIds: ['1234'],
            costCenter: 'LEL',
            costObject: 'LUL',
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
        ]);

        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        const li = await SecutixLineItem.query().findById('1234');
        const tx = await li.$relatedQuery('diamantTransaction');

        expect(tx).toBeDefined();
        expect(tx).toMatchObject({
            number: expect.stringContaining(aggregationLineItem.groupingKey),
            documentType: aggregationLineItem.documentType,
            referenceDate: parseISOUTC(aggregationLineItem.referenceDate),
            ledgerAccount: aggregationLineItem.ledgerAccount,
            direction: aggregationLineItem.paymentSale,
            vatRate: null,
            amount: String(aggregationLineItem.amount),
            costCenter: aggregationLineItem.costCenter,
            costObject: aggregationLineItem.costObject,
        });
    });

    it('trims an overly long grouping key', async () => {
        const referenceDate = new Date('2021-11-04');

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        await SecutixLineItem.query()
            .insert({
                id: '12345',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(referenceDate),
            groupingKey: 'Erhaltene Anzahlungen',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: 23000,
            vatRate: undefined,
            sourceLineIds: ['1234', '12345'],
            costCenter: undefined,
            costObject: undefined,
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
        ]);


        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        const li = await SecutixLineItem.query().findById('1234');
        const tx = await li.$relatedQuery('diamantTransaction');

        expect(tx).toBeDefined();
        expect(tx).toMatchObject({
            number: expect.stringContaining('Erhaltene'),
            documentType: aggregationLineItem.documentType,
            referenceDate: parseISOUTC(aggregationLineItem.referenceDate),
            ledgerAccount: aggregationLineItem.ledgerAccount,
            direction: aggregationLineItem.paymentSale,
            vatRate: null,
            amount: String(aggregationLineItem.amount),
            costCenter: null,
            costObject: null,
        });
    });

    it('marks line items as processed', async () => {
        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(processableDate),
                data: {},
            });

        await SecutixLineItem.query()
            .insert({
                id: '12345',
                referenceDate: formatISODate(processableDate),
                data: {
                    kind: 'COMPOSED_PRODUCT',
                },
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(processableDate),
            groupingKey: 'WTS GK',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: 23000,
            vatRate: undefined,
            sourceLineIds: ['1234'],
            costCenter: 'LEL',
            costObject: 'LUL',
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
        ]);

        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        const lineItems = await SecutixLineItem.query()
            .whereIn('id', ['1234', '12345']);

        for (const li of lineItems) {
            expect(li.processedAt).not.toBeNull();
        }
    });

    it('retries on duplicate diamant transaction numbers', async () => {
        const referenceDate = new Date('2021-11-04');
        genRandomDiamantTransactionNumberSuffix
            .mockReturnValueOnce('abcd')
            .mockReturnValueOnce('abcd');

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        await SecutixLineItem.query()
            .insert({
                id: '12345',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(referenceDate),
            groupingKey: 'Erhaltene Anzahlungen',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: 23000,
            vatRate: undefined,
            sourceLineIds: ['1234'],
            costCenter: undefined,
            costObject: undefined,
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
            { ...aggregationLineItem, sourceLineIds: ['12345'] },
        ]);

        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        for (const sourceLineId of ['1234', '12345']) {
            const li = await SecutixLineItem.query().findById(sourceLineId);
            const tx = await li.$relatedQuery('diamantTransaction');

            expect(tx).toBeDefined();
            expect(tx).toMatchObject({
                number: expect.stringContaining('Erhaltene'),
                documentType: aggregationLineItem.documentType,
                referenceDate: parseISOUTC(aggregationLineItem.referenceDate),
                ledgerAccount: aggregationLineItem.ledgerAccount,
                direction: aggregationLineItem.paymentSale,
                vatRate: null,
                amount: String(aggregationLineItem.amount),
                costCenter: null,
                costObject: null,
            });
        }
    });

    it('allows case sensitive diamant transactions numbers', async () => {
        const referenceDate = new Date('2021-11-04');
        genRandomDiamantTransactionNumberSuffix
            .mockReturnValueOnce('abcd')
            .mockReturnValueOnce('aBcd')
            .mockReturnValueOnce('aBcd')
            .mockReturnValueOnce('aBcd');

        await SecutixLineItem.query()
            .insert({
                id: '1234',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        await SecutixLineItem.query()
            .insert({
                id: '12345',
                referenceDate: formatISODate(referenceDate),
                data: {},
            });

        const lineAggregator = setupSecutixLineAggregator();
        const aggregationLineItem = {
            referenceDate: formatISODate(referenceDate),
            groupingKey: 'Erhaltene Anzahlungen',
            ledgerAccount: '2305',
            documentType: 'STBA',
            paymentSale: 'P',
            amount: 23000,
            vatRate: undefined,
            sourceLineIds: ['1234'],
            costCenter: undefined,
            costObject: undefined,
        };

        lineAggregator.getAggregatedRecords.mockReturnValue([
            aggregationLineItem,
            { ...aggregationLineItem, sourceLineIds: ['12345'] },
        ]);

        const process = new ProcessSecutixLineItems(lineAggregator);
        await process.execute();

        for (const sourceLineId of ['1234', '12345']) {
            const li = await SecutixLineItem.query().findById(sourceLineId);
            const tx = await li.$relatedQuery('diamantTransaction');

            expect(tx).toBeDefined();
            expect(tx).toMatchObject({
                number: expect.stringContaining('Erhaltene'),
                documentType: aggregationLineItem.documentType,
                referenceDate: parseISOUTC(aggregationLineItem.referenceDate),
                ledgerAccount: aggregationLineItem.ledgerAccount,
                direction: aggregationLineItem.paymentSale,
                vatRate: null,
                amount: String(aggregationLineItem.amount),
                costCenter: null,
                costObject: null,
            });
        }
    });
});
