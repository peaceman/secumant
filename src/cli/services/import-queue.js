'use strict';

const log = require("../../log");
const { getImportQueue, getImportQueueScheduler, getImportQueueWorker, addScheduleJobs } = require("../../queue/import");
const { withSentry } = require("../../sentry");

exports.command = 'import-queue';
exports.describe = 'starts the import queue';
exports.handler = withSentry(async argv => {
    log.info('Starting import queue');

    const queue = getImportQueue();
    const scheduler = getImportQueueScheduler();
    const worker = getImportQueueWorker();

    await addScheduleJobs(queue);
});
