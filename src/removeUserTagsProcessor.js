const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  userHelper = require('./helpers/userHelper'),
  jobName = 'RemoveUserTags';

let noOfUpdated, no2Process;

//Entry-point function for removing specific tags from users.
async function processUsers(configuration) {
  noOfUpdated = 0;
  no2Process = configuration.NoOfUsersToProcessMembershipJob || 1;
  try {
    await getMappingsList(configuration);
    const users = await loadUsers(configuration);

    console.log(`Number of users for removeUserTags loaded: ${users.length}`);
    for (const user of users) {
      if (noOfUpdated >= no2Process) {
        break;
      }
      await processUser(user, configuration);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

//load mappings for tags and groups
let mappingsList;
async function getMappingsList(configuration) {
  if (!mappingsList) {
    const response = await provider.apiGet(
      `${auth.apiConfigWithSite.uri}/lists/${configuration.MappingListId}/items?$expand=fields`,
    );
    mappingsList = response.data.value.map(function (mapping) {
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

//Load signed in users for processing.
async function loadUsers(configuration) {
  let path = encodeURI(
      `${auth.apiConfigWithSite.uri}lists/${configuration.UserListId}/items?$expand=fields&$top=999&$filter=fields/SignedIn eq null or fields/SignedIn eq 0`,
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

async function removeTag(configuration, teamId, name, userId, email) {
  let response = await provider.apiGet(
    `${auth.apiConfig.uri}/teams/${teamId}/tags?$filter=displayName eq '${name}'`,
  );
  if (response?.success && response?.data?.value?.length) {
    const existingTag = response.data.value[0],
      tagMemberIdResponse = await getTag(teamId, existingTag.id, userId);

    if (tagMemberIdResponse?.success && tagMemberIdResponse?.data?.value?.length) {
      let tagMemberId = tagMemberIdResponse.data.value[0].id;
      const deleteResponse = await provider.apiDelete(
        `${auth.apiConfig.uri}/teams/${teamId}/tags/${existingTag.id}/members/${tagMemberId}`,
      );

      if (deleteResponse) {
        const message = deleteResponse.success
          ? `The tag ${name} was removed succesfully for user with email ${email}.`
          : `Removing the tag ${name} for user with email ${email} returned an error. Please check the tag.`;

        await logging.info(configuration, message, '', {}, jobName);
      }
    }
  }
}

async function getTag(teamId, tagId, userId) {
  //endpoint returns 404 Not Found if user doesn't have the tag. Error is logged in logging list.
  const response = await provider.apiGet(
    `${auth.apiConfig.uri}/teams/${teamId}/tags/${tagId}/members?$filter=userId eq '${userId}'`,
  );

  return response;
}

//Check user mappings and update groups and tags if needed
async function processUser(user, configuration) {
  const userFields = user.fields,
    userId = userFields.ADUserId;

  const adUser = await userHelper.getADUser(userId);
  if (adUser) {
    const userMappings = mappingsList.filter(
      (m) =>
        userFields.Membership?.includes(m.Membership) ||
        userFields.OtherMemberships?.includes(m.Membership),
    );

    try {
      if (!userFields.SignedIn) {
        const tagMappings4Remove = userMappings.filter(
          (m) => m.Tag && ['Data-Digitalisation'].some((t) => t == m.Tag),
        );
        for (const m of tagMappings4Remove) {
          await removeTag(configuration, m.O365GroupId, m.Tag, userId, userFields.Email);
        }
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
