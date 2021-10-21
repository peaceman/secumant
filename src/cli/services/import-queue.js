'use strict';

const log = require("../../log");
const { getImportQueue, getImportQueueScheduler, getImportQueueWorker, addScheduleJobs } = require("../../queue/import");

exports.command = 'import-queue';
exports.describe = 'starts the import queue';
exports.handler = async argv => {
    log.info('Starting import queue');

    const queue = getImportQueue();
    const scheduler = getImportQueueScheduler();
    const worker = getImportQueueWorker();

    await addScheduleJobs(queue);
};
