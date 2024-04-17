function parseJoinMeetingId(meetingId) {
  const parsedJoinId = meetingId?.match(/\d+/g);
  let joinMeetingId;

  parsedJoinId && (joinMeetingId = parsedJoinId.join(''));

  return joinMeetingId;
}
module.exports = {
  parseJoinMeetingId: parseJoinMeetingId,
};
