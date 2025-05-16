const mockedMsal = {
  ConfidentialClientApplication: jest.fn(),
};
jest.mock('@azure/msal-node', () => mockedMsal);

const mockedAuth = {
  apiConfigWithSite: {
    uri: 'https://api.example.com/',
  },
  getAccessToken: jest.fn().mockResolvedValue({
    accessToken: {},
  }),
};
jest.mock('./auth', () => mockedAuth);

const mockedLogging = {
  error: jest.fn().mockResolvedValue(undefined),
};
jest.mock('./logging', () => mockedLogging);

const mockedProvider = {
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
};
jest.mock('./provider', () => mockedProvider);

const mockedUtils = {
  capitalize: jest.fn((str) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '',
  ),
};
jest.mock('./helpers/utils', () => mockedUtils);

const mockedAxios = {
  default: {
    request: jest.fn(),
  },
};
jest.mock('axios', () => mockedAxios);

// Import the module under test
const reportnetFlows = require('./reportnet3FlowsProcessor');

describe('Reportnet3Flows', () => {
  // Store the original env and restore it after tests
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.REACT_APP_REPORTNET3_KEY = 'test-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('processFlows', () => {
    const mockConfiguration = {
      UserListId: 'user-list-id',
      ReportnetFlowsListId: 'flows-list-id',
      Reportnet3DataflowUrl: 'https://reportnet.example.com/dataflows/',
    };

    it('should process flows for all countries', async () => {
      // Mock getCountries to return test countries
      const mockCountries = ['Country1', 'Country2'];
      mockedProvider.apiGet.mockImplementation((url) => {
        if (url.includes('/columns')) {
          return {
            data: {
              value: [
                {
                  name: 'Country',
                  choice: {
                    choices: mockCountries,
                  },
                },
              ],
            },
          };
        } else if (url.includes('items?$expand=fields&$top=999')) {
          return {
            success: true,
            data: {
              value: [
                { id: 'flow1', fields: { DataflowId: '1' } },
                { id: 'flow2', fields: { DataflowId: '2' } },
              ],
            },
          };
        }
      });

      // Mock loadReportnetFlows
      const mockReportnetFlows = [
        {
          id: '1',
          name: 'Flow 1',
          dataflowLink: 'https://example.com/flow1',
          obligation: {
            oblTitle: 'Obligation 1',
            obligationLink: 'https://example.com/obligation1',
            legalInstrument: {
              sourceAlias: 'Legal 1',
              legalInstrumentLink: 'https://example.com/legal1',
            },
          },
          deadlineDate: '2023-12-31',
          status: 'active',
          representatives: [
            {
              leadReporters: [{ email: 'test1@example.com' }, { email: 'test2@example.com' }],
            },
          ],
          releasedDates: ['2023-01-01', '2023-02-01'],
          reportingDatasets: [{ status: 'complete', creationDate: 1672531200000 }],
        },
      ];

      mockedAxios.default.request.mockResolvedValue({
        data: {
          totalRecords: 1,
          dataflows: mockReportnetFlows,
        },
      });

      // Mock saveFlow
      mockedProvider.apiPatch.mockResolvedValue({
        success: true,
        data: { id: 'flow1-updated' },
      });

      mockedProvider.apiPost.mockResolvedValue({
        success: true,
        data: { id: 'flow-new' },
      });

      // Call the function
      const result = await reportnetFlows.processFlows(mockConfiguration);

      // Assertions
      expect(mockedProvider.apiGet).toHaveBeenCalledTimes(2);
      expect(mockedProvider.apiPost).toHaveBeenCalledTimes(0);
      expect(mockedLogging.error).not.toHaveBeenCalled();
      expect(result).toBeUndefined(); // Successful execution returns undefined
    });

    it('should handle errors and log them', async () => {
      const testError = new Error('Test error');
      mockedProvider.apiGet.mockRejectedValue(testError);

      const result = await reportnetFlows.processFlows(mockConfiguration);

      expect(mockedLogging.error).toHaveBeenCalledWith(
        mockConfiguration,
        testError,
        'Reportnet3Flows',
      );
      expect(result).toBe(testError);
    });
  });
});
