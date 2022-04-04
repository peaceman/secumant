'use strict';

const Sentry = require("@sentry/node");
const bunyan = require("bunyan");
const stream = require("stream");

const log = bunyan.createLogger({
    name: 'secumant',
    serializers: bunyan.stdSerializers,
});

log.addStream({
    level: "debug",
    stream: new stream.Writable({
        write(c, encoding, next) {
            const chunk = JSON.parse(c);
            const { msg, hostname, level, name, pid, time, v, ...rest } = chunk;

            Sentry.addBreadcrumb({
                message: msg,
                level: bunyan.nameFromLevel[chunk.level],
                data: rest,
            });

            next();
        }
    }),
});

module.exports = log;
