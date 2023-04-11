const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  jobName = 'UpdateMeetingRegistrations';

let configuration = undefined,
  authResponse = undefined;

const PHYSICAL_PARTICIPATION_TEXT = 'Physical Participation',
  EEA_REIMBURSEMENT_TEXT = 'EEA Reimbursement requested';

//Entry point function for meeting processing functionality
async function processMeetings(config, authResp) {
  configuration = config;
  authResponse = authResp;
  try {
    const meetings = await loadMeetings(configuration.MeetingListId);
    await logging.info(
      configuration,
      authResponse.accessToken,
      'Number of meetings to process for registration: ' + meetings.length,
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
  //get meetings that have not started and have meetingRegistrationLink
  const last24Hours = new Date(),
    filterString = "&$filter=fields/Meetingstart gt '" + last24Hours.toDateString() + "'";
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + 'lists/' + meetingListId + '/items?$expand=fields' + filterString,
    authResponse.accessToken,
  );
  if (response.success) {
    return response.data.value.filter((m) => m.fields.MeetingRegistrationLink);
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
    await logging.error(
      configuration,
      authResponse.accessToken,
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
          authResponse.accessToken,
        );

      if (meetingResponse.success && meetingResponse.data.value.length) {
        const meetingId = meetingResponse.data.value[0].id;

        await processRegistrations(userId, meetingId, meetingFields);
      } else {
        await logging.error(
          configuration,
          authResponse.accessToken,
          'Unable to load meeting with id and manager specified userId: ' +
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
        authResponse.accessToken,
        'Missing JoinMeetingId for meeting id: ' + meetingFields.id,
        jobName,
      );
    }
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return false;
  }
}

async function processRegistrations(userId, meetingId, meetingFields) {
  const apiRoot = auth.apiConfig.uri,
    registrationsResponse = await provider.apiGet(
      apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/registration/registrants',
      authResponse.accessToken,
    );

  if (registrationsResponse.success && registrationsResponse.data.value.length > 0) {
    for (const registration of registrationsResponse.data.value) {
      await processSingleRegistration(meetingFields, registration);
    }

    await logging.info(
      configuration,
      authResponse.accessToken,
      'Success: ' +
        meetingFields.Title +
        ': ' +
        registrationsResponse.data.value.length +
        ' new registrations recorded',
      '',
      {},
      jobName,
    );
  }
}

async function processSingleRegistration(meetingFields, registration) {
  try {
    const userData = await getUserByMail(registration.email);

    const existingParticipant = await getParticipant(meetingFields.id, registration.email);

    let participantName = registration.firstName + ' ' + registration.lastName;
    userData && (participantName = userData.displayName);

    const record2Save = {
      fields: {
        Participantname: participantName,
        ...(userData && { Countries: userData.country }),
        MeetingtitleLookupId: meetingFields.id,
        EMail: registration.email,
        Registered: registration.status === 'registered',
        RegistrationDate: registration.registrationDateTime,
        PhysicalParticipation: registration.customQuestionAnswers.some((q) => {
          return q.value?.toLowerCase() == PHYSICAL_PARTICIPATION_TEXT.toLowerCase();
        }),
        EEAReimbursementRequested: registration.customQuestionAnswers.some((q) => {
          return q.value?.toLowerCase() == EEA_REIMBURSEMENT_TEXT.toLowerCase();
        }),
      },
    };

    if (!existingParticipant) {
      const path =
          auth.apiConfigWithSite.uri +
          'lists/' +
          configuration.MeetingParticipantsListId +
          '/items',
        response = await provider.apiPost(path, authResponse.accessToken, record2Save);

      if (response.success) {
        console.log('Meeting participant added succesfully' + JSON.stringify(record2Save));
      } else {
        await logging.error(configuration, authResponse.accessToken, response.error, jobName);
      }

      return response.success;
    } else {
      const path =
          auth.apiConfigWithSite.uri +
          'lists/' +
          configuration.MeetingParticipantsListId +
          '/items' +
          existingParticipant.fields.id,
        response = await provider.apiPatch(path, authResponse.accessToken, record2Save);

      if (response.success) {
        console.log('Meeting participant updated succesfully' + JSON.stringify(record2Save));
      } else {
        await logging.error(configuration, authResponse.accessToken, response.error, jobName);
      }

      return response.success;
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
      auth.apiConfig.uri + "/users/?$filter=mail eq '" + email?.replace("'", "''") + "'",
      authResponse.accessToken,
    );
    if (adResponse.success && adResponse.data.value.length) {
      console.log('Loaded participant user data' + JSON.stringify(adResponse));
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
      configuration.MeetingParticipantsListId +
      '/items?$filter=fields/MeetingtitleLookupId eq ' +
      meetingId +
      ' and fields/';
    if (email) {
      path += "EMail eq '" + email?.replace("'", "''") + "'";
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
module.exports = {
  processMeetings: processMeetings,
};
