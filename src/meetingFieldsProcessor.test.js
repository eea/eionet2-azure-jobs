const axios = require('axios');
const auth = require('./auth');
const processor = require('./meetingFieldsProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

const validMeetingObject = {
    createdBy: {
      user: {
        email: 'mg.nicolae@7lcpdm.onmicrosoft.com',
        id: '3c45ac4d-e740-4681-aacd-f558dde7cf2d',
        displayName: 'Gabriel-Mihai Nicolae (MK)',
      },
    },
    fields: {
      id: '2',
      ContentType: 'Item',
      Title: 'First EEA-Eionet editorial meeting',
      Meetingstart: '2022-01-28T09:00:00Z',
      Meetingend: '2022-01-28T10:30:00Z',
      MeetingmanagerLookupId: '30',
      Group: 'Communications',
      JoinMeetingId: '256 856 969',
      NoOfParticipants: 0,
      Countries: '',
    },
  },
  missingJoinIdMeetingObject = {
    fields: {
      id: '2',
      Title: 'First EEA-Eionet editorial meeting',
      Meetingstart: '2022-01-28T09:00:00Z',
      Meetingend: '2022-01-28T10:30:00Z',
      MeetingmanagerLookupId: '30',
      Group: 'Communications',
    },
  },
  invalidJoinIdMeetingObject = {
    fields: {
      id: '2',
      Title: 'First EEA-Eionet editorial meeting',
      Meetingstart: '2022-01-28T09:00:00Z',
      Meetingend: '2022-01-28T10:30:00Z',
      MeetingmanagerLookupId: '30',
      Group: 'Communications',
      JoinMeetingId: '256 856 969   // test // ',
    },
  };
test('processMeetings', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('&$filter=fields/Meetingstart ge'))) {
      return Promise.resolve({
        success: true,
        data: {
          value: [validMeetingObject],
        },
      });
    } else if (
      url.includes(encodeURI('onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq '))
    ) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
              joinUrl: 'TestUrl',
            },
          ],
        },
      });
    } else if (
      url.includes(
        encodeURI('items?$expand=fields&$top=999&$filter=fields/MeetingtitleLookupId eq'),
      )
    ) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              fields: {
                Countries: 'DE',
                Participated: true,
                Registered: true,
              },
            },
            {
              fields: {
                Countries: 'RO',
                Participated: true,
                Registered: true,
              },
            },
            {
              fields: {
                Countries: 'AT',
                Participated: true,
                Registered: true,
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

  return processor.processMeetings('').then((data) => expect(data).toEqual(undefined));
});

test('missing joinMeetingId', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('/items?$expand=fields'))) {
      return Promise.resolve({
        success: true,
        data: {
          value: [missingJoinIdMeetingObject],
        },
      });
    } else if (
      url.includes(encodeURI('/onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq'))
    ) {
      return Promise.resolve({
        success: true,
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

  return processor.processMeetings('').then((data) => expect(data).toEqual(undefined));
});

test('missing meeting id', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('&$filter=fields/Processed eq 0'))) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              fields: {
                id: '2',
                MeetingmanagerLookupId: '30',
              },
            },
          ],
        },
      });
    } else if (url.includes(encodeURI('lists/User Information List/items/'))) {
      return Promise.resolve({
        success: true,
        data: {
          fields: {
            EMail: 'test@test.com',
          },
        },
      });
    } else if (url.includes(encodeURI('users/test@test.com'))) {
      return Promise.resolve({
        success: true,
        data: {
          id: 'userId',
        },
      });
    }
  });

  auth.getAccessToken.mockImplementation(() => {
    return {
      accessToken: {},
    };
  });

  return processor.processMeetings('').then((data) => expect(data).toEqual(undefined));
});

test('wrong join meeting id', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes(encodeURI('/items?$expand=fields&$top=999'))) {
      return Promise.resolve({
        success: true,
        data: {
          value: [invalidJoinIdMeetingObject],
        },
      });
    } else if (
      url.includes(encodeURI('/onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq'))
    ) {
      return Promise.resolve({
        success: true,
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

  return processor.processMeetings('').then((data) => expect(data).toEqual(undefined));
});
