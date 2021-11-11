'use strict';

const { formatISO, parseISO } = require('date-fns');
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
    const unprocessableDate = new Date('2021-11-03');
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

    it('ignores line items that are newer then last sunday', async () => {
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

    it('processes unprocessed line items that are older than last sunday', async () => {
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
});
