const soapStub = require('soap/soap-stub');
const MockDate = require('mockdate');
const { SessionService } = require('./session');
const { addSeconds, addMinutes } = require('date-fns');

describe('session', () => {
    const apiConfig = {
        baseUrl: 'https://secutix/services',
        auth: {
            username: 'magicians',
            password: 'choice',
            tenant: '2305',
        },
    };

    let soapClient;
    /** @type {SessionService} */
    let session;

    beforeEach(() => {
        soapClient = setupSoapClient();
        session = new SessionService(apiConfig, () => soapClient);
    });

    afterEach(() => {
        MockDate.reset();
    });

    it('fetches session keys', async () => {
        soapClient.SaveAsync.mockResolvedValue([
            {
                SaveResult: true,
                key: 'dis is key',
                messages: null,
            }, // result
            undefined, // rawResponse
            undefined, // soapHeader
            undefined, // rawRequest
        ]);

        const sessionKey = await session.getSessionKey();

        expect(sessionKey).toBe('dis is key');
        expect(soapClient.SaveAsync).toHaveBeenCalledWith({
            data: {
                User: apiConfig.auth.username,
                Password: apiConfig.auth.password,
                Company: apiConfig.auth.tenant,
            },
        });
    });

    it('returns session keys from cache', async () => {
        soapClient.SaveAsync.mockResolvedValue([
            {
                SaveResult: true,
                key: 'dis is key',
                messages: null,
            }, // result
            undefined, // rawResponse
            undefined, // soapHeader
            undefined, // rawRequest
        ]);

        expect(await session.getSessionKey()).toBe('dis is key');
        expect(await session.getSessionKey()).toBe('dis is key');

        expect(soapClient.SaveAsync).toHaveBeenCalledWith({
            data: {
                User: apiConfig.auth.username,
                Password: apiConfig.auth.password,
                Company: apiConfig.auth.tenant,
            },
        });
        expect(soapClient.SaveAsync).toHaveBeenCalledTimes(1);
    });

    it('invalidates session key cache after 30m', async () => {
        soapClient.SaveAsync.mockResolvedValue([
            {
                SaveResult: true,
                key: 'dis is key',
                messages: null,
            }, // result
            undefined, // rawResponse
            undefined, // soapHeader
            undefined, // rawRequest
        ]);

        const date = new Date();
        MockDate.set(date);
        expect(await session.getSessionKey()).toBe('dis is key');
        MockDate.set(addMinutes(date, 30));
        expect(await session.getSessionKey()).toBe('dis is key');

        expect(soapClient.SaveAsync).toHaveBeenCalledWith({
            data: {
                User: apiConfig.auth.username,
                Password: apiConfig.auth.password,
                Company: apiConfig.auth.tenant,
            },
        });
        expect(soapClient.SaveAsync).toHaveBeenCalledTimes(2);
    });

    function setupSoapClient() {
        return {
            SaveAsync: jest.fn(),
        };
    }
});
