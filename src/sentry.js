const Sentry = require("@sentry/node");
const config = require("config");
const log = require("./log");

const sentryConfig = config.get("sentry");

if (sentryConfig.dsn) {
    log.info({ dsn: sentryConfig.dsn }, "Initializing sentry");

    Sentry.init({
        dsn: sentryConfig.dsn,
        debug: false,
    });
}

function withSentry(handler, scope = undefined) {
    return async (...a) => {
        try {
            return await handler(...a);
        } catch (e) {
            Sentry.captureException(e, scope);
            throw e;
        } finally {
            await Sentry.flush();
        }
    };
}

function withSentryQueueProcessor(handler) {
    const hub = Sentry.getCurrentHub();

    return async job => {
        const scope = hub.pushScope();
        scope.clearBreadcrumbs();

        try {
            return await handler(job);
        } catch (e) {
            hub.captureException(e);
            throw e;
        } finally {
            hub.popScope();
            await Sentry.flush();
        }
    };
}

module.exports = {
    withSentry,
    withSentryQueueProcessor,
};
