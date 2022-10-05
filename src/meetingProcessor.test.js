const axios = require('axios');
const processor = require('./meetingProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('processMeetings', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields')) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
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
                Modified: '2022-06-22T12:23:56Z',
                Created: '2022-06-07T14:25:47Z',
                AuthorLookupId: '10',
                EditorLookupId: '1073741822',
                _UIVersionString: '21.0',
                Attachments: false,
                Edit: '',
                LinkTitleNoMenu: 'First EEA-Eionet editorial meeting',
                LinkTitle: 'First EEA-Eionet editorial meeting',
                ItemChildCount: '0',
                FolderChildCount: '0',
                _ComplianceFlags: '',
                _ComplianceTag: '',
                _ComplianceTagWrittenTime: '',
                _ComplianceTagUserId: '',
                AppEditorLookupId: '30',
                Meetingstart: '2022-01-28T09:00:00Z',
                Meetingend: '2022-01-28T10:30:00Z',
                Group: 'Communications',
                Meetinglink: 'Test',
                Linktofolder: {
                  Description: 'Meeting folder',
                  Url: 'https://eea1.sharepoint.com/:f:/r/teams/-EXT-Eionet/Shared%20Documents/Communications/Editorial%20meetings/First%20Editorial%20Meeting%20-%2028-01-22?csf=1&web=1&e=aaQMOE',
                },
              },
            },
          ],
        },
      });
    } else if (url.includes('/onlineMeetings?$filter=JoinWebUrl eq')) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
            },
          ],
        },
      });
    } else if (
      url.includes('/attendanceReports') &&
      !url.includes('?$expand=attendanceRecords')
    ) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
            },
          ],
        },
      });
    } else if (url.includes('?$expand=attendanceRecords')) {
      return Promise.resolve({
        success: true,
        data: {
          attendanceRecords: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              emailAddress: 'test@test.com',
              identity: {
                displayName: 'Test Display Name',
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

  return processor
    .processMeetings('', authResponse)
    .then((data) => expect(data).toEqual(undefined));
});

test('processMeetings', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields')) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
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
                Modified: '2022-06-22T12:23:56Z',
                Created: '2022-06-07T14:25:47Z',
                AuthorLookupId: '10',
                EditorLookupId: '1073741822',
                _UIVersionString: '21.0',
                Attachments: false,
                Edit: '',
                LinkTitleNoMenu: 'First EEA-Eionet editorial meeting',
                LinkTitle: 'First EEA-Eionet editorial meeting',
                ItemChildCount: '0',
                FolderChildCount: '0',
                _ComplianceFlags: '',
                _ComplianceTag: '',
                _ComplianceTagWrittenTime: '',
                _ComplianceTagUserId: '',
                AppEditorLookupId: '30',
                Meetingstart: '2022-01-28T09:00:00Z',
                Meetingend: '2022-01-28T10:30:00Z',
                Group: 'Communications',
                Meetinglink: 'Test',
                Linktofolder: {
                  Description: 'Meeting folder',
                  Url: 'https://eea1.sharepoint.com/:f:/r/teams/-EXT-Eionet/Shared%20Documents/Communications/Editorial%20meetings/First%20Editorial%20Meeting%20-%2028-01-22?csf=1&web=1&e=aaQMOE',
                },
              },
            },
          ],
        },
      });
    } else if (url.includes('/onlineMeetings?$filter=JoinWebUrl eq')) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
              id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
            },
          ],
        },
      });
    } else if (
      url.includes('/attendanceReports') &&
      !url.includes('?$expand=attendanceRecords')
    ) {
      return Promise.resolve({
        success: true,
        data: {
          value: [],
        },
      });
    } else if (url.includes('?$expand=attendanceRecords')) {
      return Promise.resolve({
        success: true,
        data: {
          attendanceRecords: [
            {
              id: 'ae40523c-d750-41f5-9873-6346b474e5fb',
              emailAddress: 'test@test.com',
              identity: {
                displayName: 'Test Display Name',
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

  return processor
    .processMeetings('', authResponse)
    .then((data) => expect(data).toEqual(undefined));
});

test('processMeetings', () => {
  const authResponse = {
    accessToken: {},
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields')) {
      return Promise.resolve({
        success: true,
        data: {
          value: [
            {
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
                Modified: '2022-06-22T12:23:56Z',
                Created: '2022-06-07T14:25:47Z',
                AuthorLookupId: '10',
                EditorLookupId: '1073741822',
                _UIVersionString: '21.0',
                Attachments: false,
                Edit: '',
                LinkTitleNoMenu: 'First EEA-Eionet editorial meeting',
                LinkTitle: 'First EEA-Eionet editorial meeting',
                ItemChildCount: '0',
                FolderChildCount: '0',
                _ComplianceFlags: '',
                _ComplianceTag: '',
                _ComplianceTagWrittenTime: '',
                _ComplianceTagUserId: '',
                AppEditorLookupId: '30',
                Meetingstart: '2022-01-28T09:00:00Z',
                Meetingend: '2022-01-28T10:30:00Z',
                Group: 'Communications',
                //"Meetinglink": "Test",
                Linktofolder: {
                  Description: 'Meeting folder',
                  Url: 'https://eea1.sharepoint.com/:f:/r/teams/-EXT-Eionet/Shared%20Documents/Communications/Editorial%20meetings/First%20Editorial%20Meeting%20-%2028-01-22?csf=1&web=1&e=aaQMOE',
                },
              },
            },
          ],
        },
      });
    }
  });

  return processor
    .processMeetings('', authResponse)
    .then((data) => expect(data).toEqual(undefined));
});

/*
test('processMeetings', () => {
  const authResponse = {
    accessToken: {}
  };

  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (url.includes('/items?$expand=fields')) {
      return Promise.resolve({
        success: false,
      });
    }
  });

  return processor.processMeetings('', authResponse).then((data) => expect(data).toEqual(undefined));
});*/
