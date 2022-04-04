'use strict';

const log = require('../../log');
const { getExportQueue, getExportQueueScheduler, getExportQueueWorker, addScheduledJobs } = require('../../queue/export');
const { withSentry } = require("../../sentry");

exports.command = 'export-queue';
exports.describe = 'starts the export queue';
exports.handler = withSentry(async argv => {
    log.info('Starting export queue');

    const queue = getExportQueue();
    const scheduler = getExportQueueScheduler();
    const worker = getExportQueueWorker();

    await addScheduledJobs(queue);
});
