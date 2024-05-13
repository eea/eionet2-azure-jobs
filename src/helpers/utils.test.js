const utils = require('./utils');

describe('parseJoinMeetingId', () => {
  test('simple case', () => {
    expect(utils.parseJoinMeetingId('526 252 363')).toBe('526252363');
  });

  test('letters', () => {
    expect(utils.parseJoinMeetingId('526 252 363 test')).toBe('526252363');
  });

  test('spaces', () => {
    expect(utils.parseJoinMeetingId('   526 252 363 ')).toBe('526252363');
  });

  test('no spaces', () => {
    expect(utils.parseJoinMeetingId('526252363')).toBe('526252363');
  });
});
