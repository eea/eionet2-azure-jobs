const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  jobName = 'UserMembershipUpdates';

let noOfUpdated, no2Process;

//Entry-point function for processing user memberships from Eionet sharepoint user list
async function processUsers(configuration) {
  noOfUpdated = 0;
  no2Process = configuration.NoOfUsersToProcessMembershipJob || 1;
  try {
    await getMappingsList(configuration);
    await getCountryCodeMappingsList(configuration);
    const users = await loadUsers(configuration);

    console.log(`Number of users for userMembershipUpdates loaded: ${users.length}`);
    for (const user of users) {
      if (noOfUpdated >= no2Process) {
        break;
      }
      await processUser(user, configuration);
    }
    console.log(`Number of users with inconsistencies: ${noOfUpdated}`);
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

let countryMapping;
async function getCountryCodeMappingsList(configuration) {
  if (!countryMapping) {
    countryMapping = {};

    const response = await provider.apiGet(
      `${auth.apiConfigWithSite.uri}/lists/${configuration.CountryCodeMappingListId}/items?$expand=fields`,
    );
    response.data.value.forEach(
      (mapping) => (countryMapping[mapping.fields.Title] = mapping.fields.CountryName),
    );
  }
  return countryMapping;
}

function getCountryName(countryCode) {
  return countryMapping?.[countryCode];
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

async function addTag(configuration, teamId, name, userId, email) {
  let response = await provider.apiGet(
    `${auth.apiConfig.uri}/teams/${teamId}/tags?$filter=displayName eq '${name}'`,
  );

  let postResponse;

  if (response?.success && response?.data?.value?.length) {
    const existingTag = response.data.value[0],
      tagMemberIdResponse = await getTag(teamId, existingTag.id, userId);

    if (!tagMemberIdResponse?.data?.value?.length) {
      postResponse = await provider.apiPost(
        `${auth.apiConfig.uri}/teams/${teamId}/tags/${existingTag.id}/members`,
        {
          userId: userId,
        },
      );
    }
  } else {
    postResponse = await provider.apiPost(`${auth.apiConfig.uri}/teams/${teamId}/tags/`, {
      displayName: name,
      members: [
        {
          userId: userId,
        },
      ],
    });
  }

  if (postResponse && !postResponse.success) {
    await logging.info(
      configuration,
      `The tag ${name} could not be applied for user with email ${email}`,
      '',
      {},
      jobName,
    );
  }
}

async function getTag(teamId, tagId, userId) {
  let response;
  try {
    //endpoint returns 404 Not Found if user doesn't have the tag. Error is logged in logging list, but is must not break the save flow.
    response = await provider.apiGet(
      `${auth.apiConfig.uri}/teams/${teamId}/tags/${tagId}/members?$filter=userId eq '${userId}'`,
    );
  } catch (err) {
    console.log(err);
  }
  return response;
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

  const adUser = await getADUser(userId);
  if (adUser) {
    const userMappings = mappingsList.filter(
      (m) =>
        userFields.Membership?.includes(m.Membership) ||
        userFields.OtherMemberships?.includes(m.Membership),
    );

    const userGroupIds = getDistinctGroupsIds(userMappings);
    //if NFP add specific groups if not already present.
    if (userFields.NFP) {
      !userGroupIds.includes(configuration.NFPGroupId) &&
        userGroupIds.push(configuration.NFPGroupId);
      !userGroupIds.includes(configuration.MainEionetGroupId) &&
        userGroupIds.push(configuration.MainEionetGroupId);
    }

    const existingGroups = await getExistingGroups(userId, userGroupIds);
    try {
      const inconsistentGroupIds = userGroupIds.filter((id) => !existingGroups?.includes(id));

      for (const groupId of inconsistentGroupIds) {
        await postUserGroup(groupId, userId);
      }

      let tagMappings = userMappings.filter((m) => m.Tag);
      //if not update all tags will update only tags from inconsistencies
      !configuration.UpdateAllTags &&
        (tagMappings = tagMappings.filter((t) => inconsistentGroupIds.includes(t.O365GroupId)));

      const tags = [...new Set(tagMappings)];
      for (const m of tags) {
        await addTag(configuration, m.O365GroupId, m.Tag, userId, userFields.Email);
        await addTag(
          configuration,
          m.O365GroupId,
          getCountryName(userFields.Country),
          userId,
          userFields.Email,
        );
      }

      //check and add nfp tag
      if (userFields.NFP) {
        await addTag(
          configuration,
          configuration.MainEionetGroupId,
          'National-Focal-Points',
          userId,
          userFields.Email,
        );
        await addTag(
          configuration,
          configuration.MainEionetGroupId,
          getCountryName(userFields.Country),
          userId,
          userFields.Email,
        );
      }

      if (inconsistentGroupIds.length) {
        await logging.info(
          configuration,
          `User with email ${userFields.Email} and ADUserId ${userFields.ADUserId} had inconsistencies and was updated`,
          '',
          {},
          jobName,
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

//load Ad user based on id
async function getADUser(userId) {
  const adResponse = await provider.apiGet(
    `${auth.apiConfig.uri}users/?$filter=id eq '${userId}'&$select=id,displayName,givenName,surname,country`,
  );
  if (adResponse.success && adResponse.data.value.length) {
    return adResponse.data.value[0];
  }
  return undefined;
}

module.exports = {
  processUsers: processUsers,
};
