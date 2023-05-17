const axios = require('axios');
const auth = require('./auth');
const provider = require('./provider');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('info', () => {
  const resp = { success: true };
  axios.post.mockResolvedValue(resp);
  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  return provider.apiPost().then((data) => expect(data.success).toEqual(true));
});

test('error', () => {
  const resp = { success: true };
  axios.post.mockResolvedValue(resp);
  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  return provider.apiPost().then((data) => expect(data.success).toEqual(true));
});
