const processor = require('./userRemovalProcessor');

jest.mock('axios');
jest.mock('@azure/msal-node');
jest.mock('./auth');

describe('userRemovalProcessor', () => {
  test('Signed In null in no activity', () => {
    const userData = {
        createdDateTime: '2022-04-25',
        fields: {
          SignedIn: null,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('Signed In 0 no activity', () => {
    const userData = {
        createdDateTime: '2022-04-25',
        fields: {
          SignedIn: 0,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('Signed In 0 no activity new', () => {
    const userData = {
        createdDateTime: '2024-04-25',
        fields: {
          SignedIn: 0,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(false);
  });

  test('Signed In 1 no activity', () => {
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {},
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });

  test('Signed In 1 with activity', () => {
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {
        signInActivity: {
          lastSignInDateTime: '2024-03-01',
        },
      },
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(false);
  });

  test('Signed In 1 with activity in the past', () => {
    const userData = {
        createdDateTime: '2023-04-01',
        fields: {
          SignedIn: 1,
        },
      },
      activity = {
        signInActivity: {
          lastSignInDateTime: '2023-03-01',
        },
      },
      filterDate = new Date('2023-04-25'),
      lastSignInDate = new Date('2023-08-01');
    expect(processor.shouldRemoveUser(userData, activity, filterDate, lastSignInDate)).toBe(true);
  });
});
