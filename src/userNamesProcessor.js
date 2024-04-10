const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  userHelper = require('./helpers/userHelper'),
  jobName = 'UserNameUpdates';

//Entry-point function for processing user names from Eionet sharepoint user list
async function processUsers(configuration) {
  try {
    const users = await loadUsers(configuration.UserListId);
    console.log('Number of users for userNameUpdates loaded: ' + users.length);
    for (const user of users) {
      await processUser(user, configuration);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadUsers(listId) {
  //set filterDate 30 days ago
  const filterDate = new Date(new Date().setDate(new Date().getDate() - 30));

  let path = encodeURI(
      auth.apiConfigWithSite.uri +
        'lists/' +
        listId +
        "/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1 and fields/SignedInDate ge '" +
        filterDate.toDateString() +
        "'",
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

//Check if user has correct displayName and update it if not.
async function processUser(user, configuration) {
  const userFields = user.fields;

  const adUser = await userHelper.getADUser(userFields.ADUserId);
  if (adUser) {
    const displayName = buildDisplayName(adUser, userFields);

    if (adUser.displayName != displayName) {
      await patchUser(userFields, displayName, configuration);
    }
  }
}

//Construct correct displayName for user
function buildDisplayName(adUser, spUser) {
  if (adUser.country) {
    let displayName = spUser.Title + ' (' + adUser.country + ')';
    if (spUser.NFP) {
      displayName = spUser.Title + ' (NFP-' + adUser.country + ')';
    }
    return displayName;
  } else if (spUser.Country) {
    let displayName = spUser.Title + ' (' + spUser.Country + ')';
    if (spUser.NFP) {
      displayName = spUser.Title + ' (NFP-' + spUser.Country + ')';
    }
    return displayName;
  } else {
    return spUser.Title;
  }
}

//Update AD user display name
async function patchUser(userFields, displayName, configuration) {
  try {
    const apiPath = auth.apiConfig.uri + 'users/' + userFields.ADUserId,
      response = await provider.apiPatch(apiPath, {
        displayName: displayName,
      });
    if (response.success) {
      await logging.info(
        configuration,

        'User name was updated: ' + displayName,
        '',
        {},
        jobName,
        '',
        userFields.Email,
      );
      return response.data;
    } else {
      throw response?.error;
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

module.exports = {
  processUsers: processUsers,
};
