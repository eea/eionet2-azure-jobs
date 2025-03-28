function parseJoinMeetingId(meetingId) {
  const parsedJoinId = meetingId?.match(/\d+/g);
  let joinMeetingId;

  parsedJoinId && (joinMeetingId = parsedJoinId.join(''));

  return joinMeetingId;
}

function capitalize(str) {
  const result = str?.toLowerCase().replace(/_/g, ' ');
  return result.charAt(0).toUpperCase() + result.slice(1);
}
module.exports = {
  parseJoinMeetingId: parseJoinMeetingId,
  capitalize: capitalize,
};
