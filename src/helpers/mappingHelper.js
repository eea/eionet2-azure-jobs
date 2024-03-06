const provider = require('../provider'),
  auth = require('../auth');

let mappingsList;
async function initialize(configuration) {
  !mappingsList && (await getMappingsList(configuration));
}

//load mappings for tags and groups
async function getMappingsList(configuration) {
  if (!mappingsList) {
    const response = await provider.apiGet(
      `${auth.apiConfigWithSite.uri}/lists/${configuration.MappingListId}/items?$expand=fields`,
    );
    mappingsList = response?.data?.value.map(function (mapping) {
      return {
        TeamURL: mapping.fields.TeamURL,
        O365GroupId: mapping.fields.O365GroupId,
        Membership: mapping.fields.Membership,
        Tag: mapping.fields.Tag,
        MailingGroupId: mapping.fields.MailingGroupId,
        AdditionalGroupId: mapping.fields.AdditionalGroupId,
      };
    });
  }
  return mappingsList;
}

function getMappings() {
  return mappingsList || [];
}

module.exports = {
  initialize: initialize,
  getMappings: getMappings,
};
