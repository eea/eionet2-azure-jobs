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
                ContentType: 'Item',
                Title: 'REAL Ionel Ganea',
                Modified: '2022-08-29T00:00:46Z',
                Gender: 'Male',
                Country: 'RO',
                Email: 'toyet68222@sartess.com',
                Membership: [
                  'Communications',
                  'Data-Digitalisation',
                  'Forests',
                ],
                Phone: '65161530656520',
                OrganisationLookupId: '4',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                OtherMemberships: ['ETC-ST'],
                SignedIn: true,
                SignedInDate: '2022-04-06T07:30:32Z',
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
              displayName: 'REAL Ionel Ganea (RO)',
              userType: 'Guest',
              externalUserState: 'Accepted',
              externalUserStateChangeDateTime: '2022-04-06T07:30:32Z',
            },
          ],
        },
      });
    }
  });

  processor
    .processUsers('', authResponse)
    .then((data) => expect(data).toEqual(undefined));
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
                ContentType: 'Item',
                Title: 'REAL Ionel Ganea',
                Modified: '2022-08-29T00:00:46Z',
                Gender: 'Male',
                Country: 'RO',
                Email: 'toyet68222@sartess.com',
                Membership: [
                  'Communications',
                  'Data-Digitalisation',
                  'Forests',
                ],
                Phone: '65161530656520',
                OrganisationLookupId: '4',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                OtherMemberships: ['ETC-ST'],
                SignedIn: true,
                SignedInDate: '2022-04-06T07:30:32Z',
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

  processor
    .processUsers('', authResponse)
    .then((data) => expect(data).toEqual(undefined));
});
