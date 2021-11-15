'use strict';

const config = require('config');
const { Queue } = require('bullmq');
const { createQueue, createQueueWorker, createQueueScheduler } = require('./funcs');

/**
 * @type {import('./funcs').QueueInfo}
 */
const queueInfo = {
    name: 'diamant-transaction-export',
    redisConnectionUrl: config.get('redis.connectionUrl'),
    processor: async job => {
        const { exportDiamantTransactions } = require('../export');
        await exportDiamantTransactions.execute();
    },
};

const getExportQueue = (() => {
    let queue;

    return () => {
        if (!queue) {
            queue = createQueue(queueInfo);
        }

        return queue;
    };
})();

const getExportQueueWorker = (() => {
    let worker;

    return () => {
        if (!worker) {
            worker = createQueueWorker(queueInfo);
        }

        return worker;
    };
})();

const getExportQueueScheduler = (() => {
    let scheduler;

    return () => {
        if (!scheduler) {
            scheduler = createQueueScheduler(queueInfo);
        }

        return scheduler;
    };
})();

async function addScheduledJobs(queue) {
    const options = config.get('export.jobOptions');
    await queue.add('export', {}, options);
}

module.exports = {
    getExportQueue,
    getExportQueueWorker,
    getExportQueueScheduler,
    addScheduledJobs,
};
