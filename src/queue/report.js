'use strict';

const config = require('config');
const { Queue } = require('bullmq');
const { createQueue, createQueueWorker, createQueueScheduler } = require('./funcs');

/**
 * @type {import('./funcs').QueueInfo}
 */
const queueInfo = {
    name: 'diamant-transaction-report',
    redisConnectionUrl: config.get('redis.connectionUrl'),
    processor: async job => {
        const { reportDiamantTransactions } = require('../export');
        await reportDiamantTransactions.execute();
    },
};

const getReportQueue = (() => {
    let queue;

    return () => {
        if (!queue) {
            queue = createQueue(queueInfo);
        }

        return queue;
    };
})();

const getReportQueueWorker = (() => {
    let worker;

    return () => {
        if (!worker) {
            worker = createQueueWorker(queueInfo);
        }

        return worker;
    };
})();

const getReportQueueScheduler = (() => {
    let scheduler;

    return () => {
        if (!scheduler) {
            scheduler = createQueueScheduler(queueInfo);
        }

        return scheduler;
    };
})();

async function addScheduledJobs(queue) {
    const options = config.get('report.jobOptions');
    await queue.add('report', {}, options);
}

module.exports = {
    getReportQueue,
    getReportQueueWorker,
    getReportQueueScheduler,
    addScheduledJobs,
};
