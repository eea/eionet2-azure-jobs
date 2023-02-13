const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  jobName = 'UpdateSignedInUsers';

//Entry point function for processing users that have signed it in Eionet
async function processSignedInUsers(configuration, authResponse) {
  try {
    const users = await loadUsers(configuration.UserListId, authResponse);

    await logging.info(
      configuration,
      authResponse.accessToken,
      'Number of user for signedIn to process: ' + users.length,
      '',
      {},
      jobName,
    );
    for (const user of users) {
      await processUser(user, configuration, authResponse);
    }
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
    return error;
  }
}

async function loadUsers(listId, authResponse) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri +
      'lists/' +
      listId +
      '/items?$expand=fields&$top=999&$filter=fields/SignedIn eq null or fields/SignedIn eq 0',
    authResponse.accessToken,
  );
  if (response.success) {
    return response.data.value;
  }
  return [];
}

//Main function the processes each record loaded and checks if user had completed the sing-in process.
async function processUser(user, configuration, authResponse) {
  const apiRoot = auth.apiConfig.uri,
    userFields = user.fields;

  try {
    if (userFields.ADUserId) {
      const adUser = await getADUser(configuration, userFields.ADUserId, authResponse.accessToken);

      if (adUser) {
        const response = await provider.apiGet(
          apiRoot +
            "/reports/credentialUserRegistrationDetails?$filter=userDisplayName eq '" +
            adUser.displayName +
            "'",
          authResponse.accessToken,
        );
        if (response.success && response.data.value.length) {
          let responseValue = response.data.value[0];
          let isMfaRegistered = responseValue.isMfaRegistered;
          let isSignedIn = adUser.userType == 'Guest' && isMfaRegistered;
          let signedInDate = adUser.externalUserStateChangeDateTime
            ? adUser.externalUserStateChangeDateTime
            : new Date();

          if (isSignedIn) {
            await logging.info(
              configuration,
              authResponse.accessToken,
              'User with the following id marked as signedIn: ' + userFields.id,
              '',
              {},
              jobName,
            );
            await patchSPUser(
              userFields.id,
              {
                SignedIn: isSignedIn,
                SignedInDate: signedInDate,
              },
              configuration,
              authResponse.accessToken,
            );
          }
        }
      } else {
        await logging.error(
          configuration,
          authResponse.accessToken,
          'User with the following id was not found in AD ' + userFields.ADUserId,
          jobName,
        );
      }
    }
  } catch (error) {
    await logging.error(configuration, authResponse.accessToken, error, jobName);
  }
}

//Load AD user information
async function getADUser(configuration, userId, accessToken) {
  try {
    const adResponse = await provider.apiGet(
      auth.apiConfig.uri +
        "/users/?$filter=id eq '" +
        userId +
        "'&$select=id,displayName,userType,externalUserState,externalUserStateChangeDateTime",
      accessToken,
    );
    if (adResponse.success && adResponse.data.value.length) {
      return adResponse.data.value[0];
    }
    return undefined;
  } catch (error) {
    await logging.error(configuration, accessToken, error, jobName);
    return undefined;
  }
}

//Mark user as signedIn in sharepoint list
async function patchSPUser(userId, userData, configuration, accessToken) {
  try {
    const path =
        auth.apiConfigWithSite.uri + 'lists/' + configuration.UserListId + '/items/' + userId,
      response = await provider.apiPatch(path, accessToken, {
        fields: {
          SignedIn: userData.SignedIn,
          SignedInDate: userData.SignedInDate,
        },
      });
    if (response.success) {
      return response.data;
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, accessToken, error, jobName);
    return undefined;
  }
}

module.exports = {
  processSignedInUsers: processSignedInUsers,
};
