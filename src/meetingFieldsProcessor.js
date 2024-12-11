const provider = require('./provider'),
  logging = require('./logging'),
  auth = require('./auth'),
  userHelper = require('./helpers/userHelper'),
  utils = require('./helpers/utils'),
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
    console.log('Number of meetings to process for fields update: ' + meetings.length);
    for (const meeting of meetings) {
      await processMeeting(meeting);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadMeetings(meetingListId) {
  //get meetings from last 8 weeks to current date
  const currentDate = new Date(),
    last4Weeks = new Date(currentDate.setDate(currentDate.getDate() - 8 * 7)),
    filterString = _updateAll
      ? ''
      : "&$filter=fields/Meetingstart ge '" + last4Weeks.toDateString() + "'";
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri +
      'lists/' +
      meetingListId +
      '/items?$expand=fields&$top=999' +
      filterString,
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
  const joinMeetingId = utils.parseJoinMeetingId(meeting.JoinMeetingId);
  try {
    if (joinMeetingId) {
      const userId = await userHelper.getLookupADUserId(meeting.MeetingmanagerLookupId);
      const adUser = await userHelper.getADUser(userId);
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
        } else {
          await logging.error(
            configuration,
            `Meeting link for ${meeting.Title} could not be generated. Check that the meeting organiser ${adUser?.mail} and meeting code are correct`,
            jobName,
            undefined,
            adUser?.mail,
          );
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
          meetingId,
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
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
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
    updateParticipated =
      _updateAll ||
      (meetingStartDate <= currentDate &&
        currentDate <= new Date(meetingStartDate.setDate(meetingStartDate.getDate() + 4 * 7)));

  const countries = [
    ...new Set(
      participants
        .filter((p) => p.fields.Participated)
        .map((p) => p.fields.Countries)
        .filter((c) => !!c),
    ),
  ];

  try {
    const path =
      auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingListId + '/items/' + meeting.id;

    let response = await provider.apiGet(path);
    if (response.success) {
      const meetingFields = response.data.fields;

      const participantsCount = participants.filter((p) => p.fields.Participated).length,
        registeredCount = participants.filter((p) => p.fields.Registered).length;

      const existingCountries = meetingFields.Countries?.length
          ? meetingFields.Countries.sort().join(',')
          : undefined,
        newCountries = countries?.length ? countries.sort().join(',') : undefined;

      if (
        meetingFields.MeetingLink != meetingJoinLink ||
        (updateParticipated && meetingFields.NoOfParticipants != participantsCount) ||
        (updateRegistered && meetingFields.NoOfRegistered != registeredCount) ||
        existingCountries != newCountries
      ) {
        response = await provider.apiPatch(path, {
          fields: {
            ...(meetingJoinLink && { MeetingLink: meetingJoinLink }),
            ...(updateParticipated && {
              NoOfParticipants: participantsCount,
            }),
            ...(updateRegistered && {
              NoOfRegistered: registeredCount,
            }),
            ...(countries && {
              'Countries@odata.type': 'Collection(Edm.String)',
              Countries: countries,
            }),
          },
        });
        if (response.success) {
          console.log('Meeting fields updated succesfully : ' + meeting.Title);
          return response.data;
        }
      }
    } else {
      console.log(`No changes to meeting ${meeting.Title}. Skip patch`);
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
