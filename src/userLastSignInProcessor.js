const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  mappingHelper = require('./helpers/mappingHelper'),
  jobName = 'UserLastSignIn';

const tagHelper = require('./helpers/tagHelper');

//Entry point function for processing last sign id date for users that have signed it in Eionet
let configuration;
let users2Update = [];
async function processUserLastSignIn(config) {
  configuration = config;
  try {
    await mappingHelper.initialize(configuration);
    await tagHelper.initialize(jobName, configuration);

    console.log('Loading users');
    const users = await loadUsers(configuration.UserListId);
    console.log('Loading sing in activity');
    const signInActivities = await loadSignInActivities();
    for (const user of users) {
      const userFields = user.fields,
        activity = signInActivities.find((sa) => sa.id == userFields.ADUserId);
      if (activity?.signInActivity) {
        const lastSignInDate = new Date(activity.signInActivity.lastSignInDateTime);
        if (
          !userFields.LastSignInDate ||
          lastSignInDate.getTime() > new Date(userFields.LastSignInDate).getTime()
        ) {
          userFields.LastSignInDate = lastSignInDate;
          users2Update.push(user);
        }
      } else {
        console.log(`User ${userFields.Title} - ${userFields.Email} has no sign in activity.`);
        console.log(activity);
      }
    }

    //limit the no of users for testing purposes
    //users2Update = users2Update.slice(0, 5);

    if (users2Update.length > 0) {
      console.log('The following users will be updated.');
      users2Update.forEach((user) => {
        const userFields = user.fields;
        console.log(
          `${userFields.Title} - ${userFields.Country} - ${userFields.Email} - ${userFields.LastSignInDate}`,
        );
      });
      for (const user of users2Update) {
        await updateUser(user);
      }
    } else {
      console.log('No users to update.');
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadUsers(listId) {
  let path = encodeURI(
    auth.apiConfigWithSite.uri +
    'lists/' +
    listId +
    '/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1',
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

async function updateUser(user) {
  const userFields = user.fields;
  try {
    const path = `${auth.apiConfigWithSite.uri}lists/${configuration.UserListId}/items/${userFields.id}`;
    await provider.apiPatch(path, {
      fields: {
        LastSignInDate: userFields.LastSignInDate,
      },
    });
  } catch (err) {
    console.log(err);
    return;
  }
}

module.exports = {
  processUserLastSignIn: processUserLastSignIn,
};
