const provider = require('../provider'),
  auth = require('../auth');

async function getCountries(configuration) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + '/lists/' + configuration.UserListId + '/columns',
  );
  const columns = response.data.value;

  const countryColumn = columns.find((column) => column.name === 'Country');
  if (countryColumn && countryColumn.choice) {
    return countryColumn.choice.choices;
  }

  return [];
}

async function getOrganisations(configuration, authResponse, country) {
  let path =
    auth.apiConfigWithSite.uri +
    '/lists/' +
    configuration.OrganisationListId +
    '/items?$expand=fields';
  if (country) {
    path += "&$filter=fields/Country eq '" + country + "' or fields/Unspecified eq 1";
  }
  const response = await provider.apiGet(path, authResponse.accessToken);
  return response.data.value.map(function (organisation) {
    return {
      Name: organisation.fields.Title,
      Id: organisation.id,
      Unspecified: organisation.fields.Unspecified,
    };
  });
}

async function getConsultationsGroups(configuration) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + '/lists/' + configuration.ConsultationListId + '/columns',
  );
  const columns = response.data.value;

  const groupsColumn = columns.find((column) => column.name === 'EionetGroups');
  if (groupsColumn && groupsColumn.choice) {
    return groupsColumn.choice.choices;
  }
}

async function getMeetingsGroups(configuration) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + '/lists/' + configuration.MeetingListId + '/columns',
  );
  const columns = response.data.value;

  const groupsColumn = columns.find((column) => column.name === 'Group');
  if (groupsColumn && groupsColumn.choice) {
    return groupsColumn.choice.choices;
  }
}

async function getUsersGroups(configuration) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + '/lists/' + configuration.UserListId + '/columns',
  );
  const columns = response.data.value;

  const groupsColumn = columns.find((column) => column.name === 'Membership');
  if (groupsColumn && groupsColumn.choice) {
    return groupsColumn.choice.choices;
  }
}

function getRandomDate() {
  const today = new Date();
  const timestamp = today.getTime() + Math.floor(Math.random() * 1e10);
  return new Date(timestamp);
}

module.exports = {
  getCountries: getCountries,
  getOrganisations: getOrganisations,
  getConsultationsGroups: getConsultationsGroups,
  getRandomDate: getRandomDate,
  getMeetingsGroups: getMeetingsGroups,
  getUsersGroups: getUsersGroups,
};
