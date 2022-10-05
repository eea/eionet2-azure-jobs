const axios = require('axios');
const provider = require('./provider');

jest.mock('axios');

test('info', () => {
  const resp = { success: true };
  axios.post.mockResolvedValue(resp);

  return provider.apiPost().then((data) => expect(data.success).toEqual(true));
});

test('error', () => {
  const resp = { success: true };
  axios.post.mockResolvedValue(resp);

  return provider.apiPost().then((data) => expect(data.success).toEqual(true));
});
