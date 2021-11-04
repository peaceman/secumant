'use strict';

const log = require('../../log');
const { getTransformQueue, getTransformQueueScheduler, getTransformQueueWorker, addTransformScheduleJobs } = require('../../queue/transform');

exports.command = 'transform-queue';
exports.describe = 'starts the transform queue';
exports.handler = async argv => {
    log.info('Starting the transform queue');

    const queue = getTransformQueue();
    const scheduler = getTransformQueueScheduler();
    const worker = getTransformQueueWorker();

    await addTransformScheduleJobs(queue);
};
