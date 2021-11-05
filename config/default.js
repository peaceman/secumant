module.exports = {
    diamant: {
        baseUrl: undefined,
        auth: {
            username: undefined,
            password: undefined,
            tenant: undefined,
        },
        httpProxy: {
            protocol: 'http',
            host: undefined,
            port: undefined,
            auth: {
                username: undefined,
                password: undefined,
            },
        },
    },
    secutix: {
        baseUrl: undefined,
        auth: {
            username: undefined,
            password: undefined,
        },
        exportQuery: undefined,
    },
    database: {
        host: undefined,
        port: undefined,
        user: undefined,
        password: undefined,
        name: undefined,
    },
    redis: {
        connectionUrl: undefined,
    },
    import: {
        jobOptions: {
            repeat: {
                every: 60000,
            },
        },
    },
    transform: {
        jobOptions: {
            repeat: {
                cron: '0 9 * * 2', // every tuesday at 9am
            },
        },
    },
    aggregation: {
        paymentKindCash: 'Bargeld',
        paymentKindCard: 'Zahlkart',
        operatorLedgerAccounts: undefined,
        cardTypeLedgerAccounts: undefined,
        cardTypeDocumentTypes: undefined,
        ledgerAccountsWithVatRate: undefined,
        clearingAccount: undefined,
        taxCodeMapping: {},
    }
};
