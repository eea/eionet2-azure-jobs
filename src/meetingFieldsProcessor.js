const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  jobName = 'UpdateMeetingFields';

let configuration = undefined,
  //if set to true ignores filters and updates all meetings.
  _updateAll = false;


//Entry point function for meeting fields processing functionality
async function processMeetings(config, updateAll) {
  _updateAll = updateAll;
  configuration = config;
  try {
    const meetings = await loadMeetings(configuration.MeetingListId);
    await logging.info(
      configuration,

      'Number of meetings to process for fields update: ' + meetings.length,
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
  //get meetings from last 4 weeks to current date
  const currentDate = new Date(),
    last4Weeks = new Date(currentDate.setDate(currentDate.getDate() - 4 * 7)),
    filterString = _updateAll ? '' : "&$filter=fields/Meetingstart ge '" + last4Weeks.toDateString() + "'";
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + 'lists/' + meetingListId + '/items?$expand=fields&$top=999' + filterString,
  );
  if (response.success) {
    return response.data.value;
  } else {
    return [];
  }
}

//Main function for processing meeting record in sharepoint list
async function processMeeting(meeting) {
  const meetingFields = meeting.fields;
  try {
    const meetingJoinInfo = await getMeetingJoinInfo(meetingFields),
      meetingParticipants = await getParticipants(meeting.id);

    await patchMeeting(meetingFields, meetingJoinInfo, meetingParticipants);
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return false;
  }
}

//load meeting join information based on the provided JoinMeetingId
async function getMeetingJoinInfo(meeting) {
  const joinMeetingId = meeting.JoinMeetingId && meeting.JoinMeetingId.split(' ').join('');
  try {
    if (joinMeetingId) {
      const userId = await getADUserId(meeting.MeetingmanagerLookupId);
      if (userId) {
        const response = await provider.apiGet(
          auth.apiConfig.uri +
          '/users/' +
          userId +
          "/onlineMeetings?$filter=joinMeetingIdSettings/JoinMeetingId eq '" +
          joinMeetingId +
          "'",
        );
        if (response.success && response.data.value && response.data.value.length > 0) {
          return response.data.value[0];
        }
      }
      return undefined;
    }
  } catch (err) {
    console.log(err);
    return undefined;
  }
}

//Get participants from the sharepoint list
async function getParticipants(meetingId) {
  try {
    let path = encodeURI(
      auth.apiConfigWithSite.uri +
      'lists/' +
      configuration.MeetingParticipantsListId +
      '/items?$expand=fields&$top=999&$filter=fields/MeetingtitleLookupId eq ' +
      meetingId),
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

//Update meeting join Info and participants counters
async function patchMeeting(meeting, meetingJoinInfo, participants) {
  let meetingJoinLink;
  meetingJoinInfo && (meetingJoinLink = meetingJoinInfo.joinUrl);

  const currentDate = new Date(),
    meetingStartDate = new Date(meeting.Meetingstart),
    //update registered count if meeting has bot yes started
    updateRegistered = _updateAll || meetingStartDate >= currentDate,
    //update participated count if MeetingStartDate is between now and 4 weeks in the future
    updateParticipated = _updateAll || (
      meetingStartDate <= currentDate &&
      currentDate <= new Date(meetingStartDate.setDate(meetingStartDate.getDate() + 4 * 7)));

  try {
    const path =
      auth.apiConfigWithSite.uri +
      'lists/' +
      configuration.MeetingListId +
      '/items/' +
      meeting.id,
      response = await provider.apiPatch(path, {
        fields: {
          ...(meetingJoinLink && { MeetingLink: meetingJoinLink }),
          ...(updateParticipated && {
            NoOfParticipants: participants.filter((p) => p.fields.Participated).length,
          }),
          ...(updateRegistered && {
            NoOfRegistered: participants.filter((p) => p.fields.Registered).length,
          }),
        },
      });
    if (response.success) {
      await logging.info(
        configuration,
        'Meeting fields updated succesfully : ' + meeting.Title,
        '',
        {},
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
