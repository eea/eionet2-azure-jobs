const axios = require('axios'),
  auth = require('./auth'),
  processor = require('./userLastSignInProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('processUserLastSignIn', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('SignedIn')) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '36',
                Title: 'REAL Ionel Ganea',
                Country: 'RO',
                LastSignInDate: undefined,
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              },
            },
          ],
        },
      });
    } else if (url.includes('users?select=id,displayName,signInActivity')) {
      return Promise.resolve({
        data: {
          value: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              displayName: 'REAL Ionel Ganea',
              signInActivity: {
                lastSignInDateTime: '2024-08-11',
              },
            },
          ],
        },
      });
    }
  });

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  processor.processUserLastSignIn('').then((data) => expect(data).toEqual(undefined));
});
