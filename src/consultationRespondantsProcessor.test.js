const axios = require('axios');
const auth = require('./auth');
const processor = require('./consultationRespondantsProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

test('processConsultations', () => {
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.patch.mockImplementation(() => Promise.resolve({ data: {} }));
  axios.get.mockImplementation((url) => {
    if (
      url.includes(
        encodeURI(
          '$expand=fields&$top=999&$filter=fields/ConsultationListId ne null and fields/Startdate le',
        ),
      )
    ) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '36',
                ContentType: 'Item',
                Title: 'REAL Ionel Ganea',
                ConsultationListId: 'ConsultationListIdTest',
              },
            },
          ],
        },
      });
    } else if (url.includes(encodeURI('ConsultationListIdTest'))) {
      return Promise.resolve({
        data: {
          value: [
            {
              fields: {
                id: '9950274a-ba4b-40e1-92d8-8468cced65e3',
                Country: 'RO',
              },
            },
          ],
        },
      });
    } else if (url.includes(encodeURI('columns'))) {
      return Promise.resolve({
        data: {
          value: [
            {
              name: 'Respondants',
              choice: {
                choices: ['RO'],
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

  processor.processConsultations('').then((data) => expect(data).toEqual(undefined));
});
