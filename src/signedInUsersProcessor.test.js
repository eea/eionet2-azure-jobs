const axios = require('axios');
const auth = require('./auth');
const processor = require('./signedInUsersProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('processSignedInUsers', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('filter=fields/SignedIn eq null'))) {
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
                Membership: ['Communications', 'Data-Digitalisation', 'Forests'],
                Phone: '65161530656520',
                OrganisationLookupId: '4',
                ADUserId: 'ae40523c-d750-41f5-9873-6346b474e5fb',
                OtherMemberships: ['ETC-ST'],
                SignedIn: false,
                SignedInDate: '2022-04-06T07:30:32Z',
              },
            },
          ],
        },
      });
    } else if (url.includes(encodeURI('reports/credentialUserRegistrationDetails'))) {
      return Promise.resolve({
        data: {
          value: [
            {
              id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
              userPrincipalName: 'toyet68222_sartess.com#EXT#@7lcpdm.onmicrosoft.com',
              userDisplayName: 'REAL Ionel Ganea (RO)',
              isRegistered: false,
              isEnabled: false,
              isCapable: false,
              isMfaRegistered: true,
              authMethods: [],
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

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  processor.processSignedInUsers('').then((data) => expect(data).toEqual(undefined));
});

test('processSignedInUsers', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('filter=fields/SignedIn eq null'))) {
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
                Membership: ['Communications', 'Data-Digitalisation', 'Forests'],
                Phone: '65161530656520',
                OrganisationLookupId: '4',
                ADUserId: 'wrong_id',
                OtherMemberships: ['ETC-ST'],
                SignedIn: false,
                SignedInDate: '2022-04-06T07:30:32Z',
              },
            },
          ],
        },
      });
    } else if (
      url.includes(encodeURI('reports/credentialUserRegistrationDetails')) ||
      url.includes(encodeURI('/users/?$filter=id eq'))
    ) {
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

  processor.processSignedInUsers('').then((data) => expect(data).toEqual(undefined));
});
