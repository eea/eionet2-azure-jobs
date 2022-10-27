const axios = require('axios');
const processor = require('./userNamesProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('processUsers', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields&$filter=fields/SignedIn eq 1')) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '36',
                Title: 'REAL Ionel Ganea',
                Country: 'RO',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              },
            },
          ],
        },
      });
    } else if (url.includes('/users/?$filter=id eq')) {
      return Promise.resolve({
        data: {
          value: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              displayName: 'REAL Ionel Ganea',
            },
          ],
        },
      });
    }
  });

  processor.processUsers('', authResponse).then((data) => expect(data).toEqual(undefined));
});

test('processUsers', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields&$filter=fields/SignedIn eq 1')) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '36',
                Title: 'REAL Ionel Ganea',
                Country: 'RO',
                Email: 'toyet68222@sartess.com',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                NFP: 'NFP'
              },
            },
          ],
        },
      });
    } else if (url.includes('/users/?$filter=id eq')) {
      return Promise.resolve({
        data: {
          value: [],
        },
      });
    }
  });

  processor.processUsers('', authResponse).then((data) => expect(data).toEqual(undefined));
});

test('NFP', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields&$filter=fields/SignedIn eq 1')) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '36',
                Title: 'REAL Ionel Ganea',
                Country: 'RO',
                Email: 'toyet68222@sartess.com',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                NFP: 'NFP'
              },
            },
          ],
        },
      });
    } else if (url.includes('/users/?$filter=id eq')) {
      return Promise.resolve({
        data: {
          value: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              displayName: 'REAL Ionel Ganea',
            },
          ],
        },
      });
    }
  });

  processor.processUsers('', authResponse).then((data) => expect(data).toEqual(undefined));
});

test('AD country', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields&$filter=fields/SignedIn eq 1')) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '36',
                Title: 'REAL Ionel Ganea',
                Country: 'RO',
                Email: 'toyet68222@sartess.com',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                NFP: 'NFP'
              },
            },
          ],
        },
      });
    } else if (url.includes('/users/?$filter=id eq')) {
      return Promise.resolve({
        data: {
          value: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              displayName: 'REAL Ionel Ganea',
              country: 'MK'
            },
          ],
        },
      });
    }
  });

  processor.processUsers('', authResponse).then((data) => expect(data).toEqual(undefined));
});

