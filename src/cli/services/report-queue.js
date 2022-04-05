'use strict';

const log = require('../../log');
const { getReportQueue, getReportQueueScheduler, getReportQueueWorker, addScheduledJobs } = require('../../queue/report');
const { withSentry } = require("../../sentry");

exports.command = 'report-queue';
exports.describe = 'starts the report queue';
exports.handler = withSentry(async argv => {
    log.info('Starting report queue');

    const queue = getReportQueue();
    const scheduler = getReportQueueScheduler();
    const worker = getReportQueueWorker();

    await addScheduledJobs(queue);
});
