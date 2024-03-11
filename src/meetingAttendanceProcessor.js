const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  userHelper = require('./helpers/userHelper'),
  jobName = 'UpdateMeetingParticipants';

let configuration = undefined;

//Entry point function for meeting processing functionality
async function processMeetings(config) {
  configuration = config;
  try {
    const meetings = await loadMeetings(configuration.MeetingListId);
    console.log('Number of meetings to process for attendance: ' + meetings.length);
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
  const nowDate = new Date(),
    last12hours = new Date(nowDate.getTime() - 12 * 60 * 60 * 1000),
    filterString =
      "&$filter=(fields/Processed eq 0 and fields/Meetingstart le '" +
      nowDate.toDateString() +
      "') or (fields/Processed eq 1 and fields/Meetingend ge '" +
      last12hours.toDateString() +
      "') ";
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

  const userId = await userHelper.getLookupADUserId(meetingFields.MeetingmanagerLookupId),
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
    const parsedJoinId = meetingFields.JoinMeetingId?.match(/\d+/g);
    let joinMeetingId;

    parsedJoinId && (joinMeetingId = parsedJoinId.join(''));
    if (joinMeetingId) {
      const meetingResponse = await provider.apiGet(
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
                  //for unknown reasons sometime the api returns empty records which should be processed.
                  const validAttendanceRecords =
                      reportDetailsResponse.data.attendanceRecords?.filter(
                        (ar) => ar.emailAddress || ar.identity?.displayName,
                      ),
                    hasAttendanceRecords = validAttendanceRecords.length > 0;

                  !hasAttendanceRecords &&
                    console.log(
                      'No valid attendance records found for report id: ' +
                        report.id +
                        JSON.stringify(reportDetailsResponse),
                    );

                  hasAttendanceRecords &&
                    console.log(
                      'Attendance records loaded: ' +
                        report.id +
                        JSON.stringify(reportDetailsResponse),
                    );

                  for (const attendanceRecord of validAttendanceRecords) {
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
                } else {
                  await logging.error(
                    configuration,
                    `Unable to load attendanceRecords for meeting ${meetingTitle} and organizer with id ${userId}`,
                    jobName,
                  );
                }
              }

              //Mark meeting as processed
              await patchMeeting(meetingFields.id, meetingTitle, processedReports);
            } else {
              console.log(`No new attendance reports found' ${JSON.stringify(meetingFields)}`);
            }
          } else {
            console.log(
              `Missing attendance reports. No user has joined so far the meeting. ${JSON.stringify(
                meetingFields,
              )}`,
            );
          }
        } else {
          await logging.error(configuration, attendanceReportsResponse.error, jobName);
          return attendanceReportsResponse.error;
        }
      } else {
        await logging.error(
          configuration,

          'Unable to load meeting with id and manager specified:  ' +
            meetingTitle +
            ' - ' +
            userId +
            ' ' +
            meetingResponse.error,
          jobName,
        );
        return meetingResponse.error;
      }
    } else {
      console.log('Missing or invalid JoinMeetingId for: ' + meetingTitle);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return false;
  }
}

//Process record from attendance report checking if participant already recorded in the meeting participants list.
async function processAttendanceRecord(meetingFields, attendanceRecord) {
  let userData = undefined;

  const lowerEmail = attendanceRecord?.emailAddress?.toLowerCase(),
    lowerName = attendanceRecord?.identity?.displayName?.toLowerCase();

  try {
    if (lowerEmail) {
      userData = await getUserByMail(lowerEmail);
    }

    const existingParticipant = await getParticipant(meetingFields.id, lowerEmail, lowerName);

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
      }

      return response.success;
    } else {
      const participantId = existingParticipant.id,
        path =
          auth.apiConfigWithSite.uri +
          'lists/' +
          configuration.MeetingParticipantsListId +
          '/items/' +
          participantId,
        response = await provider.apiPatch(path, {
          fields: {
            Participated: true,
          },
        });
      if (response.success) {
        console.log('Meeting participant updated succesfully ' + participantId);
      }
      return response.success;
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return false;
  }
}

//Get AD user by email address
async function getUserByMail(email) {
  const adResponse = await provider.apiGet(
    auth.apiConfig.uri + "/users/?$filter=mail eq '" + email?.replace("'", "''") + "'",
  );
  if (adResponse.success && adResponse.data.value.length) {
    console.log('Loaded participant user data' + JSON.stringify(adResponse));
    return adResponse.data.value[0];
  }
  return undefined;
}

//Get participant record from participants sharepoint list
async function getParticipant(meetingId, email, name) {
  let path =
    auth.apiConfigWithSite.uri +
    'lists/' +
    configuration.MeetingParticipantsListId +
    '/items?$select=id&$filter=fields/MeetingtitleLookupId eq ' +
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
}

//Save processed attedance reports to meeting sharepoint record.
async function patchMeeting(meetingId, meetingTitle, processedReports) {
  const processedReportsText = processedReports.join('#');
  try {
    const path =
      auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingListId + '/items/' + meetingId;

    let response = await provider.apiGet(path);
    if (response.success) {
      const meetingFields = response.data.fields;

      if (!meetingFields.Processed || meetingFields.Processedreports != processedReportsText) {
        const response = await provider.apiPatch(path, {
          fields: {
            Processedreports: processedReportsText,
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
      } else {
        console.log(`No changes to meeting ${meetingTitle}. Skip patch`);
      }
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
