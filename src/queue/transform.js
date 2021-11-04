'use strict';

const config = require('config');
const { Queue } = require('bullmq');
const { createProcessSecutixLineItems } = require('../transform');
const { createQueue, createQueueWorker, createQueueScheduler } = require('./funcs');

/**
 * @type {import('./funcs').QueueInfo}
 */
const queueInfo = {
    name: 'secutix-line-item-transform',
    redisConnectionUrl: config.get('redis.connectionUrl'),
    processor: async job => {
        const processSecutixLineItems = createProcessSecutixLineItems();
        await processSecutixLineItems.execute();
    },
};

const getTransformQueue = (() => {
    let queue;

    return () => {
        if (!queue) {
            queue = createQueue(queueInfo);
        }

        return queue;
    };
})();

const getTransformQueueWorker = (() => {
    let worker;

    return () => {
        if (!worker) {
            worker = createQueueWorker(queueInfo);
        }

        return worker;
    };
})();

const getTransformQueueScheduler = (() => {
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
async function addTransformScheduleJobs(queue) {
    const options = config.get('transform.jobOptions');
    await queue.add('transform', {}, options);
}

module.exports = {
    getTransformQueue,
    getTransformQueueWorker,
    getTransformQueueScheduler,
    addTransformScheduleJobs,
};
