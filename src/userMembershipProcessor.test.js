const axios = require('axios');
const auth = require('./auth');
const processor = require('./userNamesProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('processUsers', () => {
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

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  processor.processUsers('').then((data) => expect(data).toEqual(undefined));
});

test('processUsers', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1'))) {
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
                NFP: 'NFP',
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

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  processor.processUsers('').then((data) => expect(data).toEqual(undefined));
});

test('NFP', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1'))) {
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
                NFP: 'NFP',
              },
            },
          ],
        },
      });
    } else if (url.includes(encodeURI('/users/?$filter=id eq'))) {
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

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  processor.processUsers('').then((data) => expect(data).toEqual(undefined));
});

test('AD country', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1')) {
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
                NFP: 'NFP',
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
              country: 'MK',
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

  processor.processUsers('').then((data) => expect(data).toEqual(undefined));
});
