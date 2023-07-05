const mappings = require('./countryMappings.json');

const auth = require('../auth');
const provider = require('../provider');

async function postMapping(path, acronym, country) {
  const record2Save = {
    fields: {
      Title: acronym,
      CountryName: country,
    },
  };

  console.log(JSON.stringify(record2Save));
  await provider.apiPost(path, record2Save);
}

async function generateMappings(configuration) {
  const graphPath =
    auth.apiConfigWithSite.uri + 'lists/' + configuration.CountryCodeMappingListId + '/items';

  mappings.forEach((mapping) => {
    postMapping(graphPath, mapping.Acronym, mapping.CountryName);
  });
}

module.exports = {
  generateMappings: generateMappings,
};
