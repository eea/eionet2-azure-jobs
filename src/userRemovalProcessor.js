const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  userGroupHelper = require('./helpers/userGroupHelper'),
  mappingHelper = require('./helpers/mappingHelper'),
  userHelper = require('./helpers/userHelper'),
  jobName = 'UserRemoval';

const tagHelper = require('./helpers/tagHelper');

//Entry point function for processing users that have signed it in Eionet
let configuration;
let users2Delete = [];
async function processUserRemoval(config) {
  configuration = config;
  const filterDate = new Date(
    new Date().setDate(new Date().getDate() - configuration.RemoveNonSignedInUserNoOfDays),
  );
  try {
    await mappingHelper.initialize(configuration);
    await tagHelper.initialize(jobName, configuration);

    const users = await loadUsers(configuration.UserListId);
    const signInActivities = await loadSignInActivities();
    for (const user of users) {
      const userFields = user.fields,
        activity = signInActivities.find((sa) => sa.id == userFields.ADUserId);
      if (
        shouldRemoveUser(
          user,
          activity,
          filterDate,
          new Date(configuration.UserRemovalLastSignInDateTime),
        )
      ) {
        users2Delete.push(user);
      }
    }

    //limit the no of users for testing purposes
    //users2Delete = users2Delete.slice(0, 2);

    if (users2Delete.length > 0) {
      console.log('The following users will be removed.');
      users2Delete.forEach((user) => {
        const userFields = user.fields;
        console.log(
          `${userFields.Title} - ${userFields.Country} - ${userFields.Email} - ${user.createdDateTime}`,
        );
      });
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const readCallback = async function (text) {
        if (text.toLowerCase() == 'y') {
          for (const user of users2Delete) {
            await deleteUser(user);
          }
        }
        readline.close();
      };

      readline.question(
        'Do you want to continue? Type Y for yes, or any key for no:',
        readCallback,
      );
    } else {
      console.log('No users to remove.');
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

function shouldRemoveUser(user, activity, filterDate, lastSignInDate) {
  const userFields = user.fields,
    isSignedIn = userFields.SignedIn != null && !!userFields.SignedIn;

  return (
    (!isSignedIn && !activity?.signInActivity && new Date(user.createdDateTime) < filterDate) ||
    (isSignedIn &&
      (!activity?.signInActivity ||
        new Date(activity.signInActivity.lastSignInDateTime) < lastSignInDate))
  );
}

async function loadUsers(listId) {
  let path = encodeURI(
      auth.apiConfigWithSite.uri + 'lists/' + listId + '/items?$expand=fields&$top=999',
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

async function loadSignInActivities() {
  let path = `${auth.apiConfig.uri}users?select=id,displayName,signInActivity`,
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

async function deleteUserGroup(groupId, userId) {
  await provider.apiDelete(`${auth.apiConfig.uri}/groups/${groupId}/members/${userId}/$ref`);
}

async function deleteUser(user) {
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
      for (const groupId of existingGroups) {
        await deleteUserGroup(groupId, userId);
      }

      await provider.apiPatch(`${auth.apiConfig.uri}/users/${userId}`, {
        displayName: userFields.Title,
        department: 'Ex-Eionet',
        country: null,
      });
    } catch (err) {
      console.log(err);
      return;
    }
  } else {
    console.log("User doesn't have a valid ADUserId. Nothing to remove from AD.");
  }
  try {
    await provider.apiDelete(
      `${auth.apiConfigWithSite.uri}lists/${configuration.UserListId}/items/${user.id}`,
    );
    await logging.info(
      configuration,
      'User was removed from list.',
      '',
      userFields,
      jobName,
      'Remove user',
      userFields.Email,
    );
  } catch (err) {
    console.log(err);
    return;
  }
}

module.exports = {
  shouldRemoveUser: shouldRemoveUser,
  processUserRemoval: processUserRemoval,
};
