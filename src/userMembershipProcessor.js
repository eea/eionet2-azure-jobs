const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  userGroupHelper = require('./helpers/userGroupHelper'),
  mappingHelper = require('./helpers/mappingHelper'),
  userHelper = require('./helpers/userHelper'),
  tagHelper = require('./helpers/tagHelper'),
  jobName = 'UserMembershipUpdates';

let noOfUpdated, no2Process;

//Entry-point function for processing user memberships from Eionet sharepoint user list
async function processUsers(configuration) {
  noOfUpdated = 0;
  no2Process = configuration.NoOfUsersToProcessMembershipJob || 1;
  try {
    await mappingHelper.initialize(configuration);
    await tagHelper.initialize(jobName, configuration);

    const users = await loadUsers(configuration);

    console.log(`Number of users for userMembershipUpdates loaded: ${users.length}`);
    for (const user of users) {
      if (noOfUpdated >= no2Process) {
        break;
      }
      await processUser(user, configuration);
    }
    console.log(`Number of users with AD groups inconsistencies: ${noOfUpdated}`);
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

//Load signed in users for processing.
async function loadUsers(configuration) {
  let path = encodeURI(
      `${auth.apiConfigWithSite.uri}lists/${configuration.UserListId}/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1`,
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
}

async function postUserGroup(groupId, userId) {
  if (groupId) {
    const apiPath = `${auth.apiConfig.uri}/groups/${groupId}/members/$ref`;
    await provider.apiPost(apiPath, {
      '@odata.id': 'https://graph.microsoft.com/v1.0/directoryObjects/' + userId,
    });
  }
}

//Check user mappings and update groups and tags if needed
async function processUser(user, configuration) {
  const userFields = user.fields,
    userId = userFields.ADUserId;

  const adUser = await userHelper.getADUser(userId);
  if (adUser) {
    const userMappings = mappingHelper
      .getMappings()
      .filter(
        (m) =>
          userFields.Membership?.includes(m.Membership) ||
          userFields.OtherMemberships?.includes(m.Membership),
      );

    const userGroupIds = userGroupHelper.getDistinctGroupsIds(userMappings);
    //if NFP add specific groups if not already present.
    if (userFields.NFP) {
      !userGroupIds.includes(configuration.NFPGroupId) &&
        userGroupIds.push(configuration.NFPGroupId);
      !userGroupIds.includes(configuration.MainEionetGroupId) &&
        userGroupIds.push(configuration.MainEionetGroupId);
    }

    const existingGroups = await userGroupHelper.getExistingGroups(userId, userGroupIds);
    try {
      const inconsistentGroupIds = userGroupIds.filter((id) => !existingGroups?.includes(id));

      for (const groupId of inconsistentGroupIds) {
        await postUserGroup(groupId, userId);
      }

      let tagMappings = userMappings.filter((m) => m.Tag);
      //if not update all tags will update only tags from inconsistencies
      const updateAllTags = configuration.UpdateAllTags?.toLowerCase() == 'true';
      const inconsistentTagMappings = tagMappings.filter((t) =>
        inconsistentGroupIds.includes(t.O365GroupId),
      );

      const tagMappings2Process = [
        ...new Set(updateAllTags ? tagMappings : inconsistentTagMappings),
      ];

      tagHelper.applyTags(userFields, tagMappings2Process, updateAllTags);

      if (inconsistentGroupIds.length) {
        await logging.info(
          configuration,
          `User with email ${userFields.Email} and ADUserId ${userFields.ADUserId} had inconsistencies and was updated`,
          '',
          {},
          jobName,
          '',
          userFields.Email,
        );

        noOfUpdated++;
      }
    } catch (err) {
      console.log(err);
    }
  } else {
    console.log(
      `Invalid ADUserId ${userFields.ADUserId}. User with email ${userFields.Email} has an invalid AD user Id.`,
    );
  }
}

module.exports = {
  processUsers: processUsers,
};
