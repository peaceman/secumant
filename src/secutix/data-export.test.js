const { ApiResultError, ApiResponseStatus } = require("./api");
const { DataExportService } = require("./data-export");

describe('data-export', () => {
    let soapClient;
    let dataExport = new DataExportService({});

    beforeEach(() => {
        soapClient = setupSoapClient();
        dataExport.soapClient = soapClient;
    });

    describe('api call', () => {
        it('returns part of the result body on success', async () => {
            const expectedResult = { statusCode: 'success', foo: 'bar' };
            soapClient.MyMagicMethodAsync = jest.fn();
            soapClient.MyMagicMethodAsync.mockResolvedValue([
                {
                    MyMagicResult: expectedResult,
                },
                undefined,
                undefined,
                undefined,
            ]);

            const result = await dataExport.apiCall('MyMagicMethod', 'MyMagicResult', {});
            expect(result).toBe(expectedResult);
        });

        it('throws an exception if the response does not contain the given result key', () => {
            const mockFn = soapClient.MyMagicMethodAsync = jest.fn();
            mockFn.mockResolvedValue([
                {},
                undefined,
                undefined,
                undefined,
            ]);

            return expect(dataExport.apiCall('MyMagicMethod', 'MyMagicResult', {}))
                .rejects
                .toMatchObject({message: 'Missing result key in api result'});
        });

        it('retries a request if the response status code was in_progress', async () => {
            const resultKey = 'LEL';
            const expectedResult = {
                statusCode: ApiResponseStatus.SUCCESS,
                foo: 'bar',
            };
            const requestId = '1234';

            const mockFn = soapClient.MyMagicMethodAsync = jest.fn();
            mockFn.mockResolvedValueOnce([
                {
                    [resultKey]: {
                        statusCode: ApiResponseStatus.IN_PROGRESS,
                        requestId,
                    },
                }
            ]);

            mockFn.mockResolvedValueOnce([
                {
                    [resultKey]: expectedResult,
                }
            ]);

            const result = await dataExport.apiCall('MyMagicMethod', resultKey);
            expect(result).toBe(expectedResult);
            expect(mockFn.mock.lastCall[0]?.requestId).toBe(requestId);
        });

        it('throws an exception if the response status code was something unexpected', async () => {
            const mockFn = soapClient.MyMagicMethodAsync = jest.fn();
            mockFn.mockResolvedValue([
                {
                    MyMagicResult: {
                        statusCode: 'wat is dis',
                    },
                },
                undefined,
                undefined,
                undefined,
            ]);

            return expect(dataExport.apiCall('MyMagicMethod', 'MyMagicResult', {}))
                .rejects
                .toMatchObject({message: 'Got non success api result'});
        });
    });

    function setupSoapClient() {
        return {
            getAvailableExportsAsync: jest.fn(),
            executeExportAsync: jest.fn(),
            flagItemsAsync: jest.fn(),
            unFlagItemsAsync: jest.fn(),
            getFlaggingStatusAsync: jest.fn(),
        };
    }
});
