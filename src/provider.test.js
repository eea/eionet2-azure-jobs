const axios = require('axios');
const provider = require('./provider');

jest.mock('axios');

test('fetch', () => {
  const users = [{ name: 'Bob' }];
  const resp = { data: users };
  axios.get.mockResolvedValue(resp);

  return provider.apiGet().then((data) => expect(data.data).toEqual(users));
});

test('post', () => {
  const user = { name: 'Bob' };
  const resp = { success: true };
  axios.post.mockResolvedValue(resp);

  return provider.apiPost().then((data) => expect(data.success).toEqual(true));
});

test('patch', () => {
  const user = { name: 'Bob' };
  const resp = { success: true };
  axios.patch.mockResolvedValue(resp);

  return provider.apiPatch().then((data) => expect(data.success).toEqual(true));
});
