'use strict';

const fs = require('fs');
const { Model } = require('objection');
const { createDatabase, dropDatabase, truncateDatabase } = require('../test/database');
const MockDate = require('mockdate');
const { subYears, subDays, formatISO } = require('date-fns');
const { ImportSecutixLineItems } = require('./import-secutix-line-items');
const { SecutixLineItem } = require('../database/models');

describe('import secutix line items', () => {
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

    const lineItems = JSON.parse(fs.readFileSync(
        './fixtures/secutix/line-items.json'
    ));
    const exportQueryKey = 'magic export';

    it('starts the first import with dateFrom one year in the past', async () => {
        const dataExportService = setupDataExportService();
        const now = new Date('1980-05-23');
        MockDate.set(now);

        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        await importSecutixLineItems.execute();

        expect(dataExportService.executeExport)
            .toHaveBeenCalledWith(
                exportQueryKey,
                subYears(now, 1),
            );
    });

    it('starts further imports with dateFrom corresponding to the last flagDate', async () => {
        const dataExportService = setupDataExportService();
        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        const lastFlagDate = subDays(new Date(), 3);
        // milliseconds get lost during iso9075 conversion
        lastFlagDate.setMilliseconds(0);

        await SecutixLineItem.query().insert({
            id: '1234',
            referenceDate: formatISO(new Date(), { representation: 'date' }),
            data: {},
            flaggedAt: lastFlagDate.toISOString(),
        });

        // ensure that non flagged line items dont interfere with lastFlagDate
        await SecutixLineItem.query().insert({
            id: '1235',
            referenceDate: formatISO(new Date(), { representation: 'date' }),
            data: {},
        });

        await importSecutixLineItems.execute();

        expect(dataExportService.executeExport)
            .toHaveBeenCalledWith(
                exportQueryKey,
                lastFlagDate,
            );
    });

    it('imports line items', async () => {
        const dataExportService = setupDataExportService();
        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        dataExportService.executeExport.mockResolvedValueOnce(lineItems);

        await importSecutixLineItems.execute();

        for (const lineItem of lineItems.elements) {
            const dbLineItem = await SecutixLineItem.query()
                .findOne({id: lineItem.line_id});

            expect(dbLineItem).toBeDefined();
            expect(formatISO(dbLineItem.referenceDate, { representation: 'date' }))
                .toBe(lineItem['reference_date']);
            expect(dbLineItem.data).toStrictEqual(lineItem);
        }
    });

    it('flags imported line items', async () => {
        const dataExportService = setupDataExportService();
        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        const now = new Date();
        // milliseconds get lost during iso9075 conversion
        now.setMilliseconds(0);
        MockDate.set(now);

        dataExportService.executeExport.mockResolvedValueOnce(lineItems);
        const lineItemIds = lineItems.elements.map(li => li['line_id']);

        await importSecutixLineItems.execute();

        expect(dataExportService.flagItems).toHaveBeenCalledWith(lineItemIds, {flagDate: now});
        expect(dataExportService.flagItems.mock.calls.length).toBe(1);

        for (const lineItemId of lineItemIds) {
            const lineItem = await SecutixLineItem.query()
                .findById(lineItemId);

            expect(lineItem.flaggedAt).toEqual(now);
        }
    });

    it('doesnt flag already flagged line items', async () => {
        const dataExportService = setupDataExportService();
        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        const now = new Date();
        MockDate.set(now);

        dataExportService.executeExport.mockResolvedValueOnce(lineItems);
        const lineItemIds = lineItems.elements.map(li => li['line_id']);
        const flaggedLineItemId = lineItemIds.shift();

        await SecutixLineItem.query()
            .insert({
                id: flaggedLineItemId,
                referenceDate: '1980-05-23',
                data: {},
                flaggedAt: new Date().toISOString(),
            });

        await importSecutixLineItems.execute();

        expect(dataExportService.flagItems).toHaveBeenCalledWith(lineItemIds, {flagDate: now});
        expect(dataExportService.flagItems.mock.calls.length).toBe(1);
    });

    it('imports until there are no more line items', async () => {
        const dataExportService = setupDataExportService();
        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        dataExportService.executeExport.mockResolvedValueOnce(lineItems);
        dataExportService.executeExport.mockResolvedValueOnce(lineItems);

        await importSecutixLineItems.execute();

        expect(dataExportService.executeExport).toHaveBeenCalledTimes(3);
    });

    it('imports until max runtime is reached', async () => {
        const dataExportService = setupDataExportService();
        const importSecutixLineItems = new ImportSecutixLineItems(
            dataExportService,
            exportQueryKey,
        );

        await importSecutixLineItems.execute({maxRuntimeSec: 0});

        expect(dataExportService.executeExport).toHaveBeenCalledTimes(0);
    });

    function setupDataExportService() {
        return {
            executeExport: jest.fn().mockResolvedValue({elements: []}),
            flagItems: jest.fn(),
        };
    }
});
