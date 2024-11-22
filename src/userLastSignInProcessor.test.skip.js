const processor = require('./userLastSignInProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

describe('userLastSignInProcessor', () => {
  // test('No activity', () => {
  //   const userData = {
  //       createdDateTime: '2022-04-25',
  //       fields: {
  //         SignedIn: 1,
  //       },
  //     },
  //     activity = {},
  //     filterDate = new Date('2023-04-25'),
  //     lastSignInDate = new Date('2023-08-01');
  //   expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  // });
  // test('Signed In 0 no activity', () => {
  //   const userData = {
  //       createdDateTime: '2022-04-25',
  //       fields: {
  //         SignedIn: 0,
  //       },
  //     },
  //     activity = {},
  //     filterDate = new Date('2023-04-25'),
  //     lastSignInDate = new Date('2023-08-01');
  //   expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  // });
});
