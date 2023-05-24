const axios = require('axios');
const auth = require('./auth');
const provider = require('./provider');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('fetch', () => {
  const users = [{ name: 'Bob' }];
  const resp = { data: users };
  axios.get.mockResolvedValue(resp);

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  return provider.apiGet().then((data) => expect(data.data).toEqual(users));
});

test('post', () => {
  const resp = { success: true };
  axios.post.mockResolvedValue(resp);

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  return provider.apiPost().then((data) => expect(data.success).toEqual(true));
});

test('patch', () => {
  const resp = { success: true };
  axios.patch.mockResolvedValue(resp);

  auth.getAccessToken.mockResolvedValue(() => {
    return {
      accessToken: {},
    };
  });

  return provider.apiPatch().then((data) => expect(data.success).toEqual(true));
});
