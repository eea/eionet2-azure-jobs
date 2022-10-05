const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  jobName = 'UpdateMeetingParticipants';

//Entry point function for meeting processing functionality
async function processMeetings(configuration, authResponse) {
  try {
    const meetings = await loadMeetings(
      configuration.MeetingListId,
      authResponse
    );
    await logging.info(
      configuration,
      authResponse.accessToken,
      'UpdateMeetingParticipants - number of meetings to process: ' +
        meetings.length,
      '',
      {},
      jobName
    );
    meetings.forEach(async (meeting) => {
      await processMeeting(meeting, configuration, authResponse);
    });
  } catch (error) {
    logging.error(configuration, authResponse.accessToken, error, jobName);
    return error;
  }
}

async function loadMeetings(meetingListId, authResponse) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri +
      'lists/' +
      meetingListId +
      '/items?$expand=fields',
    authResponse.accessToken
  );
  if (response.success) {
    return response.data.value;
  } else {
    return [];
  }
}

//Main function for processing meeting record in sharepoint list
async function processMeeting(meeting, configuration, authResponse) {
  const apiRoot = auth.apiConfig.uri,
    meetingFields = meeting.fields;

  const userId = meeting.createdBy.user.id;
  if (meetingFields.Meetinglink) {
    const meetingUrl = meetingFields.Meetinglink.Url,
      meetingResponse = await provider.apiGet(
        apiRoot +
          'users/' +
          userId +
          "/onlineMeetings?$filter=JoinWebUrl eq '" +
          meetingUrl +
          "'",
        authResponse.accessToken
      ),
      processedReports = meetingFields.Processedreports
        ? meetingFields.Processedreports.split('#')
        : [];

    if (meetingResponse.success && meetingResponse.data.value.length) {
      const meetingId = meetingResponse.data.value[0].id;

      //load all attendance reports for meeting
      const attendanceReportsResponse = await provider.apiGet(
        apiRoot +
          'users/' +
          userId +
          '/onlineMeetings/' +
          meetingId +
          '/attendanceReports',
        authResponse.accessToken
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
                authResponse.accessToken
              );
              if (reportDetailsResponse.success) {
                for (const record of reportDetailsResponse.data
                  .attendanceRecords) {
                  const result = await processAttendanceRecord(
                    configuration,
                    meetingFields,
                    record,
                    authResponse.accessToken
                  );
                  reportProcessedYN = reportProcessedYN && result;
                }

                //Add reportId to processed list
                reportProcessedYN && processedReports.push(report.id);
                reportProcessedYN = true;
              }
            }

            //Mark meeting as processed
            await patchMeeting(
              meetingFields.id,
              processedReports,
              configuration,
              authResponse.accessToken
            );
          }
        } else {
          await logging.info(
            configuration,
            authResponse.accessToken,
            'UpdateMeetingParticipants - No attendance records found',
            '',
            meetingFields,
            jobName
          );
        }
      } else {
        await logging.error(
          configuration,
          authResponse.accessToken,
          attendanceReportsResponse.error,
          jobName
        );
        return attendanceReportsResponse.error;
      }
    } else {
      await logging.error(
        configuration,
        authResponse.accessToken,
        meetingResponse.error,
        jobName
      );
      return meetingResponse.error;
    }
  } else {
    await logging.info(
      configuration,
      authResponse.accessToken,
      'UpdateMeetingParticipants - Missing meeting link',
      '',
      meetingFields,
      jobName
    );
  }
}

//Process record from attendance report checking if participant already recorded in the meeting participants list.
async function processAttendanceRecord(
  configuration,
  meetingFields,
  record,
  accessToken
) {
  let userData = undefined;

  try {
    if (record.emailAddress) {
      userData = await getUserByMail(
        configuration,
        record.emailAddress,
        accessToken
      );
    }

    const existingParticipant = await getParticipant(
      configuration,
      meetingFields.id,
      record.emailAddress,
      record.identity.displayName,
      accessToken
    );

    if (!existingParticipant) {
      const record2Save = {
        fields: {
          Participantname: record.identity.displayName,
          ...(userData && { Countries: userData.country }),
          MeetingtitleLookupId: meetingFields.id,
          EMail: record.emailAddress,
          Participated: true,
          ...(meetingFields.Group && { EionetGroup: meetingFields.Group }),
        },
      };

      const path =
          auth.apiConfigWithSite.uri +
          'lists/' +
          configuration.MeetingPartcipantsListId +
          '/items',
        response = await provider.apiPost(path, accessToken, record2Save);

      return response.success;
    } else {
      return true;
    }
  } catch (error) {
    logging.error(configuration, accessToken, error, jobName);
    return false;
  }
}

//Get AD user by email address
async function getUserByMail(configuration, email, accessToken) {
  try {
    const adResponse = await provider.apiGet(
      auth.apiConfig.uri + "/users/?$filter=mail eq '" + email + "'",
      accessToken
    );
    if (adResponse.success && adResponse.data.value.length) {
      return adResponse.data.value[0];
    }
    return undefined;
  } catch (error) {
    logging.error(configuration, accessToken, error, jobName);
    return undefined;
  }
}

//Get participant record from participants sharepoint list
async function getParticipant(
  configuration,
  meetingId,
  email,
  name,
  accessToken
) {
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

    const response = await provider.apiGet(path, accessToken);
    if (response.success) {
      return response.data.value[0];
    }

    return undefined;
  } catch (error) {
    logging.error(configuration, accessToken, error, jobName);
    return undefined;
  }
}

//Save processed attedance reports to meeting sharepoint record.
async function patchMeeting(
  meetingId,
  processedReports,
  configuration,
  accessToken
) {
  try {
    const path =
        auth.apiConfigWithSite.uri +
        'lists/' +
        configuration.MeetingListId +
        '/items/' +
        meetingId,
      response = await provider.apiPatch(path, accessToken, {
        fields: {
          Processedreports: processedReports.join('#'),
        },
      });
    if (response.success) {
      return response.data;
    }

    return undefined;
  } catch (error) {
    logging.error(configuration, accessToken, error, jobName);
    return undefined;
  }
}

module.exports = {
  processMeetings: processMeetings,
};
