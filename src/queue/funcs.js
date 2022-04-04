'use strict';

const Redis = require('ioredis');
const config = require('config');
const { Queue, QueueScheduler, WorkerOptions, Processor, Worker, JobsOptions } = require('bullmq');
const log = require('../log');
const { withSentryQueueProcessor } = require("../sentry");

/**
 * @typedef {Object} QueueInfo
 * @property {string} redisConnectionUrl
 * @property {string} name
 * @property {JobsOptions|undefined} defaultJobOptions
 * @property {Processor} processor
 * @property {WorkerOptions|undefined} workerOptions
 */


/**
 * @param {string} connectionUrl
 * @returns {Redis}
 */
function createRedisConnection(connectionUrl) {
    return new Redis(connectionUrl);
}

/**
 * @param {QueueInfo} queueInfo
 * @returns {Queue}
 */
function createQueue(queueInfo) {
    const queue = new Queue(
        queueInfo.name,
        {
            defaultJobOptions: queueInfo.defaultJobOptions,
            connection: createRedisConnection(queueInfo.redisConnectionUrl),
        },
    );

    queue.waitUntilReady()
        .then(() => log.info({queueName: queueInfo.name}, 'Connected to queue'));

    return queue;
}

/**
 * @param {QueueInfo} queueInfo
 * @returns {QueueScheduler}
 */
function createQueueScheduler(queueInfo) {
    const scheduler = new QueueScheduler(queueInfo.name, {
        connection: createRedisConnection(queueInfo.redisConnectionUrl),
    });

    scheduler.waitUntilReady()
        .then(() => log.info({queueName: queueInfo.name}, 'Connected queue scheduler'));

    return scheduler;
}

/**
 * @param {QueueInfo} queueInfo
 * @returns {Worker}
 */
function createQueueWorker(queueInfo) {
    const worker = new Worker(
        queueInfo.name,
        withSentryQueueProcessor(queueInfo.processor),
        {
            ...queueInfo.workerOptions,
            connection: createRedisConnection(queueInfo.redisConnectionUrl),
        },
    );

    worker.on('error', error => {
        log.error({queueName: queueInfo.name, err: error}, 'Worker error');
    });

    worker.on('failed', (job, reason) => {
        log.error({queueName: queueInfo.name, err: reason}, 'Job failed');
    });

    worker.waitUntilReady()
        .then(() => log.info({queueName: queueInfo.name}, 'Connected queue worker'));

    return worker;
}

module.exports = {
    createQueue,
    createQueueScheduler,
    createQueueWorker,
};
