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
  let path =
      auth.apiConfigWithSite.uri +
      'lists/' +
      listId +
      '/items?$expand=fields&$top=999&$filter=fields/SignedIn eq null or fields/SignedIn eq 0',
    result = [];

  while (path) {
    const response = await provider.apiGet(path, authResponse.accessToken);
    if (response.success) {
      result = result.concat(response.data.value);
      path = response.data['@odata.nextLink'];
    } else {
      path = undefined;
    }
  }

  return result;
}

//Main function the processes each record loaded and checks if user had completed the sing-in process.
async function processUser(user, configuration, authResponse) {
  const apiRoot = auth.apiConfig.uri,
    userFields = user.fields;

  try {
    if (userFields.ADUserId) {
      const adUser = await getADUser(configuration, userFields.ADUserId, authResponse.accessToken);

      if (adUser) {
        const registrationDetailsPath =
          apiRoot +
          "reports/credentialUserRegistrationDetails?$filter=userDisplayName eq '" +
          adUser.displayName.replace("'", "''") +
          "'";
        let retry = true,
          retryCount = 1;

        while (retry && retryCount <= 5) {
          const response = await provider.apiGet(registrationDetailsPath, authResponse.accessToken);
          if (response.success && response.data.value.length) {
            retry = false;
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
                'User marked as signedIn: ' + userFields.Title,
                '',
                userFields,
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
          } else {
            if (response.error) {
              const status = response.error.response?.status;
              //request throttling by graph api
              if (status == 429) {
                const retryAfter = response.error.response.headers['retry-after'] || 0;
                console.log(
                  'Request throttled by Graph API. Retrying in ' + retryAfter + ' seconds.',
                );

                retry = true;
                retryCount++;
                await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
              }
            }
          }
        }
      } else {
        await logging.error(
          configuration,
          authResponse.accessToken,
          'User was not found in AD: ' + userFields.Title,
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
