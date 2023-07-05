const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  jobName = 'UpdateMeetingParticipants';

let configuration = undefined;

//Entry point function for meeting processing functionality
async function processMeetings(config) {
  configuration = config;
  try {
    const meetings = await loadMeetings(configuration.MeetingListId);
    await logging.info(
      configuration,

      'Number of meetings to process for attendance: ' + meetings.length,
      '',
      {},
      jobName,
    );
    for (const meeting of meetings) {
      await processMeeting(meeting);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadMeetings(meetingListId) {
  //get meetings from last 24 hours or meetings not processed so far
  const last24Hours = new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
    next24hours = new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
    filterString =
      "&$filter=(fields/Processed eq 0 or fields/Meetingstart ge '" +
      last24Hours.toDateString() +
      "') and fields/Meetingstart le '" +
      next24hours.toDateString() +
      "'";
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + 'lists/' + meetingListId + '/items?$expand=fields' + filterString,
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

  const userId = await getADUserId(meetingFields.MeetingmanagerLookupId),
    meetingTitle = meetingFields.Title;
  if (!userId) {
    await logging.error(
      configuration,

      'Missing meeting manager for meeting id: ' + meetingFields.id,
      jobName,
    );
    return;
  }
  try {
    if (meetingFields.JoinMeetingId) {
      const joinMeetingId = meetingFields.JoinMeetingId.split(' ').join(''),
        meetingResponse = await provider.apiGet(
          apiRoot +
            'users/' +
            userId +
            "/onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq '" +
            joinMeetingId +
            "'",
        ),
        processedReports = meetingFields.Processedreports
          ? meetingFields.Processedreports.split('#')
          : [];

      if (meetingResponse.success && meetingResponse.data.value.length) {
        const meetingId = meetingResponse.data.value[0].id;

        //load all attendance reports for meeting
        const attendanceReportsResponse = await provider.apiGet(
          apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/attendanceReports',
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
                );

                if (reportDetailsResponse.success) {
                  const hasAttendanceRecords =
                    reportDetailsResponse.data.attendanceRecords.length > 0;
                  !hasAttendanceRecords &&
                    console.log(
                      'No attendance records found for report id: ' +
                        report.id +
                        JSON.stringify(reportDetailsResponse),
                    );

                  hasAttendanceRecords &&
                    console.log(
                      'Attendance records loaded: ' +
                        report.id +
                        JSON.stringify(reportDetailsResponse),
                    );

                  for (const attendanceRecord of reportDetailsResponse.data.attendanceRecords) {
                    const result = await processAttendanceRecord(meetingFields, attendanceRecord);
                    reportProcessedYN = reportProcessedYN && result;
                  }

                  hasAttendanceRecords &&
                    reportProcessedYN &&
                    console.log(
                      'Meeting participants updated for attendance report id: ' + report.id,
                    );

                  //Add reportId to processed list
                  reportProcessedYN && processedReports.push(report.id);
                  reportProcessedYN = true;
                }
              }

              //Mark meeting as processed
              await patchMeeting(meetingFields.id, meetingTitle, processedReports);
            } else {
              console.log('No new attendance reports found' + JSON.stringify(meetingFields));
            }
          } else {
            console.log(
              'Missing attendance reports. No user has joined so far the meeting.' +
                JSON.stringify(meetingFields),
            );
          }
        } else {
          await logging.error(
            configuration,

            attendanceReportsResponse.error,
            jobName,
          );
          return attendanceReportsResponse.error;
        }
      } else {
        await logging.error(
          configuration,

          'Unable to load meeting with id and manager specified:  ' +
            meetingTitle +
            userId +
            ' ' +
            meetingResponse.error,
          jobName,
        );
        return meetingResponse.error;
      }
    } else {
      await logging.error(
        configuration,

        'Missing JoinMeetingId for: ' + meetingTitle,
        jobName,
      );
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
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
        },
      };

      const path =
          auth.apiConfigWithSite.uri +
          'lists/' +
          configuration.MeetingParticipantsListId +
          '/items',
        response = await provider.apiPost(path, record2Save);

      if (response.success) {
        console.log('Meeting participant added succesfully' + JSON.stringify(record2Save));
      } else {
        await logging.error(configuration, response.error, jobName);
      }

      return response.success;
    } else {
      const participantId = existingParticipant.id,
        path =
          auth.apiConfigWithSite.uri +
          'lists/' +
          configuration.MeetingParticipantsListId +
          '/items/' +
          participantId;
      await provider.apiPatch(path, {
        fields: {
          Participated: true,
        },
      });
      console.log('Meeting participant updated succesfully ' + participantId);
      return true;
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return false;
  }
}

//Get AD user by email address
async function getUserByMail(email) {
  try {
    const adResponse = await provider.apiGet(
      auth.apiConfig.uri + "/users/?$filter=mail eq '" + email?.replace("'", "''") + "'",
    );
    if (adResponse.success && adResponse.data.value.length) {
      console.log('Loaded participant user data' + JSON.stringify(adResponse));
      return adResponse.data.value[0];
    }
    return undefined;
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

//Get participant record from participants sharepoint list
async function getParticipant(meetingId, email, name) {
  try {
    let path =
      auth.apiConfigWithSite.uri +
      'lists/' +
      configuration.MeetingParticipantsListId +
      '/items?$filter=fields/MeetingtitleLookupId eq ' +
      meetingId +
      ' and fields/';
    if (email) {
      path += "EMail eq '" + email?.replace("'", "''") + "'";
    } else {
      path += "Participantname eq '" + name + "'";
    }

    const response = await provider.apiGet(path);
    if (response.success) {
      return response.data.value[0];
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

async function getADUserId(lookupId) {
  if (lookupId) {
    try {
      let path = auth.apiConfigWithSite.uri + 'lists/User Information List/items/' + lookupId;

      const response = await provider.apiGet(path);
      if (response.success) {
        const userInfo = response.data.fields;

        const adResponse = await provider.apiGet(auth.apiConfig.uri + 'users/' + userInfo.EMail);
        if (adResponse.success) {
          return adResponse.data.id;
        }
      }

      return undefined;
    } catch (error) {
      await logging.error(configuration, error, jobName);
      return undefined;
    }
  }
  return undefined;
}

//Save processed attedance reports to meeting sharepoint record.
async function patchMeeting(meetingId, meetingTitle, processedReports) {
  try {
    const path =
        auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingListId + '/items/' + meetingId,
      response = await provider.apiPatch(path, {
        fields: {
          Processedreports: processedReports.join('#'),
          Processed: true,
        },
      });
    if (response.success) {
      await logging.info(
        configuration,

        'Meeting updated succesfully : ' + meetingTitle,
        '',
        processedReports.join('#'),
        jobName,
      );
      return response.data;
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

module.exports = {
  processMeetings: processMeetings,
};
