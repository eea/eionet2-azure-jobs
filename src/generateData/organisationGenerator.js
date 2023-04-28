const generateDataHelper = require('./generateDataHelper');

const auth = require('../auth');
const provider = require('../provider');

const NO_OF_ORGANISATIONS = 400;

async function postOrganisation(path, index, country, authResponse) {
  const record2Save = {
    fields: {
      Title: 'Organisation no. ' + index,
      Country: country,
    },
  };

  console.log(JSON.stringify(record2Save));
  await provider.apiPost(path, authResponse.accessToken, record2Save);
}

async function generateOrganisations(configuration, authResponse) {
  const graphPath =
      auth.apiConfigWithSite.uri + 'lists/' + configuration.OrganisationListId + '/items',
    countries = await generateDataHelper.getCountries(configuration, authResponse);

  for (let i = 0; i < NO_OF_ORGANISATIONS; i++) {
    const countryIndex = Math.floor(Math.random() * (countries.length - 2) + 1);
    postOrganisation(graphPath, i, countries[countryIndex], authResponse);
  }
}

module.exports = {
  generateOrganisations: generateOrganisations,
};
