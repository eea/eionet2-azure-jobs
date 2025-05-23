const provider = require('./provider'),
  auth = require('./auth'),
  userHelper = require('./helpers/userHelper'),
  jobName = 'UserRemoval';

async function start() {
  const config = require('./attendanceReportFinder.json'),
    apiRoot = auth.apiConfig.uri;
  if (!config.userEmail || !config.attendanceReportId) {
    console.log('Invalid config file');
  }

  const userData = await userHelper.getUserByMail(config.userEmail.toLowerCase());

  const events = await loadEvents(userData.id);

  const meetignUrls = [
    ...new Set(
      events.filter((event) => event.isOnlineMeeting).map((event) => event.onlineMeeting?.joinUrl),
    ),
  ];
  for (let meetingUrl of meetignUrls) {
    const meetingResponse = await provider.apiGet(
      `${apiRoot}users/${userData.id}/onlineMeetings?$filter=JoinWebUrl eq '${meetingUrl}'`,
      false,
      true,
    );
    if (meetingResponse.success) {
      const meeting = meetingResponse.data?.value?.[0];
      console.log(meeting.joinMeetingIdSettings.joinMeetingId);
      console.log(`${meeting.startDateTime} - ${meeting.endDateTime}`);
      const attendanceReportsResponse = await provider.apiGet(
        `${apiRoot}users/${userData.id}/onlineMeetings/${meeting.id}/attendanceReports`,
        false,
        true,
      );
      if (attendanceReportsResponse.success) {
        const reports = attendanceReportsResponse.data?.value,
          configReport = reports.find((rp) => rp.id == config.attendanceReportId);
        reports.forEach((r) => console.log(r.id));
        if (configReport) {
          console.log(
            `${jobName}
              Attendance report found on event with meetingJoinId ${meeting.joinMeetingIdSettings.joinMeetingId}`,
          );
          console.log(`Total participants on report ${configReport.totalParticipantCount}`);
          break;
        }
      }
    }
  }
}

async function loadEvents(userId) {
  let path = encodeURI(
      `${auth.apiConfig.uri}users/${userId}/calendar/events?$filter= start/datetime ge '2025-02-15'`,
    ),
    result = [];

  while (path) {
    const response = await provider.apiGet(path, true);
    if (response.success) {
      result = result.concat(response.data.value);
      path = response.data['@odata.nextLink'];
    } else {
      path = undefined;
    }
  }

  return result;
}

module.exports = {
  start: start,
};
