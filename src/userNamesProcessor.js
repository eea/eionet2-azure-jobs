const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  jobName = 'UserNameUpdates';

//Entry-point function for processing user names from Eionet sharepoint user list
async function processUsers(configuration, authResponse) {
  try {
    const users = await loadUsers(configuration.UserListId, authResponse);
    await logging.info(
      configuration,
      authResponse.accessToken,
      'UserNameUpdates - number of records loaded: ' + users.length, '', {}, jobName
    );
    users.forEach(async (user) => {
      await processUser(user, configuration, authResponse);
    });
  } catch (error) {
    logging.error(configuration, authResponse.accessToken, error, jobName);
    return error;
  }
}

async function loadUsers(listId, authResponse) {
  //set filterDate 30 days ago
  let filterDate = new Date(new Date().setDate(new Date().getDate() - 30));

  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri +
    'lists/' +
    listId +
    "/items?$expand=fields&$filter=fields/SignedIn eq 1 && SignedDate le datetime'" +
    filterDate +
    "'",
    authResponse.accessToken
  );
  if (response.success) {
    return response.data.value;
  }
  return [];
}

//Check if user has correct displayName and update it if not.
async function processUser(user, configuration, authResponse) {
  const userFields = user.fields;

  const adUser = await getADUser(
    configuration,
    userFields.ADUserId,
    authResponse.accessToken
  );
  if (adUser) {
    const displayName = buildDisplayName(adUser, userFields);

    if (adUser.displayName != displayName) {
      await patchUser(
        userFields.ADUserId,
        displayName,
        configuration,
        authResponse.accessToken
      );
    }
  }
}

//load Ad user based on id
async function getADUser(configuration, userId, accessToken) {
  const adResponse = await provider.apiGet(
    auth.apiConfig.uri +
    "/users/?$filter=id eq '" +
    userId +
    "'&$select=id,displayName,givenName,surname,country",
    accessToken
  );
  if (adResponse.success && adResponse.data.value.length) {
    return adResponse.data.value[0];
  }
  return undefined;
}

//Construct correct displayName for user
function buildDisplayName(adUser, spUser) {
  let displayName = spUser.Title + ' (' + adUser.country + ')';
  if (spUser.NFP) {
    displayName = spUser.Title + ' (NFP-' + adUser.country + ')';
  }
  return displayName;
}

//Update AD user display name
async function patchUser(userId, displayName, configuration, accessToken) {
  try {
    const apiPath = auth.apiConfig.uri + '/users/' + userId,
      response = await provider.apiPatch(apiPath, accessToken, {
        displayName: displayName,
      });
    if (response.success) {
      await logging.info(
        configuration,
        accessToken,
        'UserNameUpdates - user with the following id was updated: ' + userId,
        '', {}, jobName
      );
      return response.data;
    } else {
      throw response?.error;
    }
  } catch (error) {
    logging.error(configuration, accessToken, error, jobName);
    return undefined;
  }
}

module.exports = {
  processUsers: processUsers,
};
