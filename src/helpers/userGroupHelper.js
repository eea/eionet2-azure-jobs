const provider = require('../provider'),
  auth = require('../auth');

function getDistinctGroupsIds(mappings) {
  let groupIds = mappings.map((m) => m.O365GroupId);

  groupIds = groupIds.concat(mappings.map((m) => m.AdditionalGroupId));
  groupIds = groupIds.concat(mappings.map((m) => m.MailingGroupId));

  return [...new Set(groupIds.filter((g) => !!g))];
}

async function getExistingGroups(userId, groupIds) {
  let result = [];

  let localGroupsIds = [...groupIds];

  //directoryObjects endpoint allows max 20 groups ids per request.
  //see: https://learn.microsoft.com/en-us/graph/api/directoryobject-checkmembergroups?view=graph-rest-1.0&tabs=http#request-body
  while (localGroupsIds.length > 0) {
    const response = await provider.apiPost(
      `${auth.apiConfig.uri}/directoryObjects/${userId}/checkMemberGroups`,
      {
        groupIds: localGroupsIds.splice(0, 20),
      },
    );

    response?.success && (result = result.concat(response?.data?.value));
  }
  return result;
}

module.exports = {
  getDistinctGroupsIds: getDistinctGroupsIds,
  getExistingGroups: getExistingGroups,
};
