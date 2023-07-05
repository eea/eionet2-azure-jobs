const generateDataHelper = require('./generateDataHelper');

const auth = require('../auth');
const provider = require('../provider');

const NO_OF_MEETINGS = 500;
const MEEETING_TYPES = ['Hybrid', 'Online', 'Physical'];

async function postMeeting(index, countries, groups, configuration) {
  let path = auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingListId + '/items';
  const randomDate = generateDataHelper.getRandomDate(),
    endDate = new Date(randomDate);
  endDate.setDate(randomDate.getDate() + 30);

  const meetingRecord = {
    fields: {
      Title: 'Meeting no. ' + index,
      Meetingstart: randomDate,
      Meetingend: endDate,
      MeetingmanagerLookupId: 10,
      'Group@odata.type': 'Collection(Edm.String)',
      Group: groups,
      MeetingType: MEEETING_TYPES[Math.floor(Math.random() * 3)],
      JoinMeetingId: Math.floor(Math.random() * 1e12) + '',
      Meetinglink: 'https://www.google.ro',
    },
  };

  const meetingResponse = await provider.apiPost(path, meetingRecord);

  if (meetingResponse.success) {
    const meetingId = meetingResponse.data.id;

    for (let i = 0; i < 19; i++) {
      const countryIndex = Math.floor(Math.random() * (countries.length - 2) + 1);
      const registered = meetingRecord.MeetingType != 'Online' && i % 2 == 0;
      const participantRecord = {
        fields: {
          Participantname: 'Participant no. ' + i,
          Countries: countries[countryIndex],
          MeetingtitleLookupId: meetingId,
          EMail: 'participant_' + i + '@mail.com',
          Participated: false,
          Registered: registered,
          ...(registered && { RegistrationDate: new Date() }),
        },
      };

      path =
        auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingParticipantsListId + '/items';
      await provider.apiPost(path, participantRecord);
    }
  }
}

async function generateMeetings(configuration) {
  const countries = await generateDataHelper.getCountries(configuration),
    groups = await generateDataHelper.getMeetingsGroups(configuration);

  for (let i = 0; i < NO_OF_MEETINGS; i++) {
    const groupsIndex = Math.floor(Math.random() * (groups.length + 1));

    await postMeeting(i, countries, groups.slice(groupsIndex), configuration);
  }
}

module.exports = {
  generateMeetings: generateMeetings,
};
