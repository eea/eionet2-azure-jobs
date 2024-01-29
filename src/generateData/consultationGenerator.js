const generateDataHelper = require('./generateDataHelper');

const auth = require('../auth');
const provider = require('../provider');

const NO_OF_CONSULTATIONS = 498;

async function postConsultation(path, index, countries, groups, authResponse) {
  const randomDate = generateDataHelper.getRandomDate(),
    deadline = new Date(randomDate),
    closed = new Date(randomDate);

  deadline.setDate(randomDate.getDate() + 30);
  closed.setDate(randomDate.getDate() + 15);
  const consultationType = index % 2 == 0 ? 'Consultation' : 'Enquiry';
  const record2Save = {
    fields: {
      ConsultationType: consultationType,
      Title: 'Consultation no. ' + index,
      Startdate: randomDate,
      Deadline: deadline,
      Closed: closed,
      'Respondants@odata.type': 'Collection(Edm.String)',
      Respondants: countries,
      ConsulationmanagerLookupId: '10',
      'EionetGroups@odata.type': 'Collection(Edm.String)',
      EionetGroups: groups,
    },
  };

  console.log(JSON.stringify(record2Save));
  await provider.apiPost(path, authResponse.accessToken, record2Save);
}

async function generateConsultations(configuration, authResponse) {
  const graphPath =
      auth.apiConfigWithSite.uri + 'lists/' + configuration.ConsultationListId + '/items',
    countries = await generateDataHelper.getCountries(configuration, authResponse),
    groups = await generateDataHelper.getConsultationsGroups(configuration, authResponse);

  for (let i = 2; i < NO_OF_CONSULTATIONS; i++) {
    const countryIndex = Math.floor(Math.random() * (countries.length - 2) + 1);

    const groupsIndex = Math.floor(Math.random() * (groups.length - 2) + 1);

    postConsultation(
      graphPath,
      i,
      countries.slice(countryIndex),
      groups.slice(groupsIndex),
      authResponse,
    );
  }
}

module.exports = {
  generateConsultations: generateConsultations,
};
