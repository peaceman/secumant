'use strict';

const config = require('config');
const { Queue } = require('bullmq');
const { createQueue, createQueueWorker, createQueueScheduler } = require('./funcs');

/**
 * @type {import('./funcs').QueueInfo}
 */
const queueInfo = {
    name: 'secutix-line-item-import',
    redisConnectionUrl: config.get('redis.connectionUrl'),
    processor: async job => {
        const { importSecutixLineItems } = require('../import');
        // limit import runtime to 55 sec as the job is repeated every minute
        await importSecutixLineItems.execute({ maxRuntimeSec: 55 });
    },
};

const getImportQueue = (() => {
    let queue;

    return () => {
        if (!queue) {
            queue = createQueue(queueInfo);
        }

        return queue;
    };
})();

const getImportQueueWorker = (() => {
    let worker;

    return () => {
        if (!worker) {
            worker = createQueueWorker(queueInfo);
        }

        return worker;
    };
})();

const getImportQueueScheduler = (() => {
    let scheduler;

    return () => {
        if (!scheduler) {
            scheduler = createQueueScheduler(queueInfo);
        }

        return scheduler;
    };
})();

/**
 * @param {Queue} queue
 */
async function addScheduleJobs(queue) {
    const options = config.get('import.jobOptions');
    await queue.add('import', {}, options);
}

module.exports = {
    getImportQueue,
    getImportQueueWorker,
    getImportQueueScheduler,
    addScheduleJobs,
};
