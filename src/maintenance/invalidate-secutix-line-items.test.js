'use strict';

const { Model } = require("objection");
const { createDatabase, dropDatabase, truncateDatabase } = require("../test/database");
const MockDate = require('mockdate');
const { SecutixLineItem } = require("../database/models/secutix-line-item");
const { formatISODate } = require("../util");
const faker = require('faker');
const { DiamantTransaction } = require("../database/models/diamant-transaction");
const { addDays, subDays } = require("date-fns");
const { InvalidateSecutixLineItems } = require("./invalidate-secutix-line-items");

jest.setTimeout(10 * 60 * 1000);
describe('invalidate secutix line items', () => {
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
            reverse: jest.fn(),
        };
    }

    function setupDataExportService() {
        return {
            unflagItems: jest.fn(),
        };
    }

    const createSecutixLineItem = (() => {
        let counter = 0;

        return async referenceDate => {
            counter += 1;
            return await SecutixLineItem.query()
                .insert({
                    id: String(counter),
                    referenceDate: formatISODate(referenceDate),
                    data: {},
                });
        };
    })();

//    async function createSecutixLineItem(referenceDate) {
//        return await SecutixLineItem.query()
//            .insert({
//                id: String(faker.unique(faker.datatype.number)),
//                referenceDate: formatISODate(referenceDate),
//                data: {},
//            });
//    }

    async function createSecutixLineItems(referenceDate, amount) {
        return await Promise.all(
            [...Array(amount).keys()]
                .map(x => createSecutixLineItem(referenceDate))
        );
    }

    async function createDiamantTransaction(secutixLineItemIds) {
        await SecutixLineItem.query()
            .patch({ processedAt: new Date().toISOString() })
            .whereIn('id', secutixLineItemIds);

        return await DiamantTransaction.query()
            .insertGraph({
                referenceDate: formatISODate(faker.datatype.datetime()),
                documentType: faker.random.alphaNumeric(4),
                number: faker.random.alphaNumeric(8),
                direction: 'P',
                amount: faker.datatype.number(),
                ledgerAccount: faker.random.alphaNumeric(4),
                key: String(faker.datatype.number()),
                secutixLineItems: (secutixLineItemIds.map(id => ({id}))),
            }, {relate: true});
    }

    it('reverses diamant transactions', async () => {
        const startDate = new Date('2021-05-23');
        const endDate = new Date('2021-05-28');

        const lineItemsA = await createSecutixLineItems(addDays(startDate, 1), 5);
        const lineItemsB = await createSecutixLineItems(addDays(startDate, 3), 5);
        const lineItemBefore = await createSecutixLineItems(subDays(startDate, 3), 2);
        const lineItemdAfter = await createSecutixLineItems(addDays(endDate, 3), 2);

        const txLineItemIds = lineItemsA.map(li => li.id);
        const txALineItemIds = txLineItemIds.slice(0, 3);
        const txBLineItemIds = txLineItemIds.slice(3, 5);

        const txA = await createDiamantTransaction(txALineItemIds);
        const txB = await createDiamantTransaction(txBLineItemIds);

        expect(await txA.$relatedQuery('secutixLineItems').resultSize()).toBe(3);
        expect(await txB.$relatedQuery('secutixLineItems').resultSize()).toBe(2);

        const secutixDataExportService = setupDataExportService();
        const diamantTransactionService = setupTransactionService();

        const invalidateSecutixLineItems = new InvalidateSecutixLineItems(
            secutixDataExportService,
            diamantTransactionService,
        );

        await invalidateSecutixLineItems.execute({ startDate, endDate, includeProcessed: true });

        expect(diamantTransactionService.reverse).toBeCalledTimes(2);
        expect(diamantTransactionService.reverse).toBeCalledWith(txA.key);
        expect(diamantTransactionService.reverse).toBeCalledWith(txB.key);

        expect(await txA.$query()).not.toBeDefined();
        expect(await txB.$query()).not.toBeDefined();
    });

    it('unflags secutix line items', async () => {
        const startDate = new Date('2021-05-23');
        const endDate = new Date('2021-05-28');

        const lineItemsB = await createSecutixLineItems(addDays(startDate, 3), 12);
        const lineItemsA = await createSecutixLineItems(addDays(startDate, 1), 8);
        const lineItemsBefore = await createSecutixLineItems(subDays(startDate, 3), 2);
        const lineItemsAfter = await createSecutixLineItems(addDays(endDate, 3), 2);

        const txLineItemIds = lineItemsA.map(li => li.id);
        const txALineItemIds = txLineItemIds.slice(0, 3);
        const txBLineItemIds = txLineItemIds.slice(3, 5);

        const txA = await createDiamantTransaction(txALineItemIds);
        const txB = await createDiamantTransaction(txBLineItemIds);

        expect(await txA.$relatedQuery('secutixLineItems').resultSize()).toBe(3);
        expect(await txB.$relatedQuery('secutixLineItems').resultSize()).toBe(2);

        const secutixDataExportService = setupDataExportService();
        const diamantTransactionService = setupTransactionService();

        const invalidateSecutixLineItems = new InvalidateSecutixLineItems(
            secutixDataExportService,
            diamantTransactionService,
        );

        await invalidateSecutixLineItems.execute({ startDate, endDate, includeProcessed: true });

        expect(secutixDataExportService.unflagItems)
            .toBeCalledWith(expect.toIncludeSameMembers(lineItemsA.map(li => li.id)));
        expect(secutixDataExportService.unflagItems)
            .toBeCalledWith(expect.toIncludeSameMembers(lineItemsB.map(li => li.id)));

        for (const li of lineItemsA.concat(lineItemsB)) {
            expect(await li.$query()).not.toBeDefined();
        }
    });

    it('ignores line items out of date range', async () => {
        const startDate = new Date('2021-05-23');
        const endDate = new Date('2021-05-28');

        const lineItemsBefore = await createSecutixLineItems(subDays(startDate, 3), 2);
        const lineItemsAfter = await createSecutixLineItems(addDays(endDate, 3), 2);

        const secutixDataExportService = setupDataExportService();
        const diamantTransactionService = setupTransactionService();

        const invalidateSecutixLineItems = new InvalidateSecutixLineItems(
            secutixDataExportService,
            diamantTransactionService,
        );

        await invalidateSecutixLineItems.execute({ startDate, endDate });

        expect(secutixDataExportService.unflagItems).not.toBeCalled();
        expect(secutixDataExportService.unflagItems).not.toBeCalled();

        for (const li of lineItemsBefore.concat(lineItemsAfter)) {
            expect(await li.$query()).toBeDefined();
        }
    });

    it('ignores processed line items when requested', async () => {
        const startDate = new Date('2021-05-23');
        const endDate = new Date('2021-05-28');

        const lineItemsA = await createSecutixLineItems(addDays(startDate, 1), 5);
        const lineItemsB = await createSecutixLineItems(addDays(startDate, 1), 5);

        const txLineItemIds = lineItemsA.map(li => li.id);
        const txALineItemIds = txLineItemIds.slice(0, 3);
        const txBLineItemIds = txLineItemIds.slice(3, 5);

        const txA = await createDiamantTransaction(txALineItemIds);
        const txB = await createDiamantTransaction(txBLineItemIds);

        expect(await txA.$relatedQuery('secutixLineItems').resultSize()).toBe(3);
        expect(await txB.$relatedQuery('secutixLineItems').resultSize()).toBe(2);

        const secutixDataExportService = setupDataExportService();
        const diamantTransactionService = setupTransactionService();

        const invalidateSecutixLineItems = new InvalidateSecutixLineItems(
            secutixDataExportService,
            diamantTransactionService,
        );

        await invalidateSecutixLineItems.execute({ startDate, endDate, includeProcessed: false });

        expect(diamantTransactionService.reverse).toBeCalledTimes(0);

        expect(await txA.$query()).toBeDefined();
        expect(await txB.$query()).toBeDefined();
    });
});
