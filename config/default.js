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
    export: {
        jobOptions: {
            repeat: {
                every: 60000,
            },
        },
    },
    aggregation: {
        paymentKindCash: 'Bargeld',
        paymentKindCard: 'Zahlkart',
        dataKeyConfig: {
            accountingCode: 'ACCOUNTING_CODE',
            operatorName: 'operator_name',
            cardType: 'CARD_TYPE',
            ledgerAccount: 'ANALYTIC1',
            documentType: 'ANALYTIC2',
            vatRate: 'VAT_RATE',
            paymentSale: 'PAYMENT_SALE',
            amount: 'amount',
            costCenter: 'ANALYTIC3',
            costObject: 'ANALYTIC4',
        },
        operatorLedgerAccounts: undefined,
        cardTypeLedgerAccounts: undefined,
        cardTypeDocumentTypes: undefined,
        ledgerAccountsWithVatRate: undefined,
        clearingAccount: undefined,
        taxCodeMapping: undefined,
        postingPeriodOverrides: [],
    },
};
