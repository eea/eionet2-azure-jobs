const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
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
        "/items?$expand=fields&$top=999&$filter=fields/SignedIn eq 1 && SignedDate le datetime'" +
        filterDate +
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

  const adUser = await getADUser(configuration, userFields.ADUserId);
  if (adUser) {
    const displayName = buildDisplayName(adUser, userFields);

    if (adUser.displayName != displayName) {
      await patchUser(userFields.ADUserId, displayName, configuration);
    }
  }
}

//load Ad user based on id
async function getADUser(configuration, userId) {
  try {
    const adResponse = await provider.apiGet(
      auth.apiConfig.uri +
        "users/?$filter=id eq '" +
        userId +
        "'&$select=id,displayName,givenName,surname,country",
    );
    if (adResponse.success && adResponse.data.value.length) {
      return adResponse.data.value[0];
    }
  } catch (error) {
    return undefined;
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
async function patchUser(userId, displayName, configuration) {
  try {
    const apiPath = auth.apiConfig.uri + 'users/' + userId,
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
