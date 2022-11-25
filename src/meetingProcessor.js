const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  jobName = 'UpdateMeetingParticipants';

let configuration = undefined,
  authResponse = undefined;

//Entry point function for meeting processing functionality
async function processMeetings(config, authResp) {
  configuration = config;
  authResponse = authResp;
  try {
    const meetings = await loadMeetings(configuration.MeetingListId);
    await logging.info(
      configuration,
      authResponse.accessToken,
      'Number of meetings to process: ' + meetings.length,
      '',
      {},
      jobName,
    );
    for (const meeting of meetings) {
      await processMeeting(meeting);
    }
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return error;
  }
}

async function loadMeetings(meetingListId) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + 'lists/' + meetingListId + '/items?$expand=fields',
    authResponse.accessToken,
  );
  if (response.success) {
    return response.data.value;
  } else {
    return [];
  }
}

//Main function for processing meeting record in sharepoint list
async function processMeeting(meeting) {
  const apiRoot = auth.apiConfig.uri,
    meetingFields = meeting.fields;

  const userId = await getADUserId(meetingFields.MeetingmanagerLookupId);
  if (!userId) {
    await logging.info(
      configuration,
      authResponse.accessToken,
      'Missing meeting manager',
      '',
      meetingFields,
      jobName,
    );
    return;
  }
  try {
    if (meetingFields.Meetinglink) {
      const meetingUrl = meetingFields.Meetinglink.Url,
        meetingResponse = await provider.apiGet(
          apiRoot +
          'users/' +
          userId +
          "/onlineMeetings?$filter=JoinWebUrl eq '" +
          meetingUrl +
          "'",
          authResponse.accessToken,
        ),
        processedReports = meetingFields.Processedreports
          ? meetingFields.Processedreports.split('#')
          : [];

      if (meetingResponse.success && meetingResponse.data.value.length) {
        const meetingId = meetingResponse.data.value[0].id;

        //load all attendance reports for meeting
        const attendanceReportsResponse = await provider.apiGet(
          apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/attendanceReports',
          authResponse.accessToken,
        );

        if (attendanceReportsResponse.success) {
          const reports = attendanceReportsResponse.data.value;
          let reportProcessedYN = true;

          if (reports.length) {
            const filteredReports = reports.filter((report) => {
              return !processedReports.includes(report.id);
            });
            //process only attendance reports that are not stored on meeting record in sharepoint list
            if (filteredReports && filteredReports.length) {
              for (const report of filteredReports) {
                const reportDetailsResponse = await provider.apiGet(
                  apiRoot +
                  'users/' +
                  userId +
                  '/onlineMeetings/' +
                  meetingId +
                  '/attendanceReports/' +
                  report.id +
                  '?$expand=attendanceRecords',
                  authResponse.accessToken,
                );

                await logging.info(
                  configuration,
                  authResponse.accessToken,
                  'Attendance records loaded',
                  '',
                  reportDetailsResponse,
                  jobName,
                );

                if (reportDetailsResponse.success) {
                  reportDetailsResponse.data.attendanceRecords.forEach(async (attendanceRecord) => {
                    const result = await processAttendanceRecord(meetingFields, attendanceRecord);
                    reportProcessedYN = reportProcessedYN && result;
                  });

                  //Add reportId to processed list
                  reportProcessedYN && processedReports.push(report.id);
                  reportProcessedYN = true;
                }
              }

              //Mark meeting as processed
              await patchMeeting(meetingFields.id, processedReports);
            } else {
              await logging.info(
                configuration,
                authResponse.accessToken,
                'No new attendance reports found',
                '',
                meetingFields,
                jobName,
              );
            }
          } else {
            await logging.info(
              configuration,
              authResponse.accessToken,
              'Missing attendance reports. No user has joined so far the meeting.',
              '',
              meetingFields,
              jobName,
            );
          }
        } else {
          await logging.error(
            configuration,
            authResponse.accessToken,
            attendanceReportsResponse.error,
            jobName,
          );
          return attendanceReportsResponse.error;
        }
      } else {
        await logging.info(
          configuration,
          authResponse.accessToken,
          'Unable to load meeting with link and manager specified userId: ' +
          userId +
          ' ' +
          meetingResponse.error,
          '',
          meetingFields,
          jobName,
        );
        return meetingResponse.error;
      }
    } else {
      await logging.info(
        configuration,
        authResponse.accessToken,
        'Missing meeting link',
        '',
        meetingFields,
        jobName,
      );
    }
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return false;
  }
}

//Process record from attendance report checking if participant already recorded in the meeting participants list.
async function processAttendanceRecord(meetingFields, attendanceRecord) {
  let userData = undefined;

  try {
    if (attendanceRecord.emailAddress) {
      userData = await getUserByMail(attendanceRecord.emailAddress);
    }

    const existingParticipant = await getParticipant(
      meetingFields.id,
      attendanceRecord.emailAddress,
      attendanceRecord.identity.displayName,
    );

    if (!existingParticipant) {
      const record2Save = {
        fields: {
          Participantname: attendanceRecord.identity.displayName,
          ...(userData && { Countries: userData.country }),
          MeetingtitleLookupId: meetingFields.id,
          EMail: attendanceRecord.emailAddress,
          Participated: true,
          ...(meetingFields.Group && { EionetGroup: meetingFields.Group }),
        },
      };

      const path =
        auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingPartcipantsListId + '/items',
        response = await provider.apiPost(path, authResponse.accessToken, record2Save);

      return response.success;
    } else {
      return true;
    }
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return false;
  }
}

//Get AD user by email address
async function getUserByMail(email) {
  try {
    const adResponse = await provider.apiGet(
      auth.apiConfig.uri + "/users/?$filter=mail eq '" + email + "'",
      authResponse.accessToken,
    );
    if (adResponse.success && adResponse.data.value.length) {
      return adResponse.data.value[0];
    }
    return undefined;
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return undefined;
  }
}

//Get participant record from participants sharepoint list
async function getParticipant(meetingId, email, name) {
  try {
    let path =
      auth.apiConfigWithSite.uri +
      'lists/' +
      configuration.MeetingPartcipantsListId +
      '/items?$filter=fields/MeetingtitleLookupId eq ' +
      meetingId +
      ' and fields/';
    if (email) {
      path += "EMail eq '" + email + "'";
    } else {
      path += "Participantname eq '" + name + "'";
    }

    const response = await provider.apiGet(path, authResponse.accessToken);
    if (response.success) {
      return response.data.value[0];
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return undefined;
  }
}

async function getADUserId(lookupId) {
  if (lookupId) {
    try {
      let path = auth.apiConfigWithSite.uri + 'lists/User Information List/items/' + lookupId;

      const response = await provider.apiGet(path, authResponse.accessToken);
      if (response.success) {
        const userInfo = response.data.fields;

        const adResponse = await provider.apiGet(
          auth.apiConfig.uri + 'users/' + userInfo.EMail,
          authResponse.accessToken,
        );
        if (adResponse.success) {
          return adResponse.data.id;
        }
      }

      return undefined;
    } catch (error) {
      await logging.error(configuration, authResponse.accessToken, error, jobName);
      return undefined;
    }
  }
  return undefined;
}

//Save processed attedance reports to meeting sharepoint record.
async function patchMeeting(meetingId, processedReports) {
  try {
    const path =
      auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingListId + '/items/' + meetingId,
      response = await provider.apiPatch(path, authResponse.accessToken, {
        fields: {
          Processedreports: processedReports.join('#'),
        },
      });
    if (response.success) {
      return response.data;
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return undefined;
  }
}

module.exports = {
  processMeetings: processMeetings,
};
