const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  mappingHelper = require('./helpers/mappingHelper'),
  userHelper = require('./helpers/userHelper'),
  jobName = 'UpdateSignedInUsers';

const tagHelper = require('./helpers/tagHelper');

//Entry point function for processing users that have signed it in Eionet
let configuration;
async function processSignedInUsers(config) {
  configuration = config;
  try {
    await mappingHelper.initialize(configuration);
    await tagHelper.initialize(jobName, configuration);

    const users = await loadUsers(configuration.UserListId);
    console.log('Number of user for signedIn to process: ' + users.length);
    for (const user of users) {
      await processUser(user);
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
        '/items?$expand=fields&$top=999&$filter=fields/SignedIn eq null or fields/SignedIn eq 0',
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

//Main function the processes each record loaded and checks if user had completed the sing-in process.
async function processUser(user) {
  const apiRoot = auth.apiConfig.uri,
    userFields = user.fields,
    userId = userFields.ADUserId;

  try {
    if (userId) {
      const adUser = await userHelper.getADUser(userId);

      if (adUser) {
        const registrationDetailsPath =
          apiRoot +
          "reports/credentialUserRegistrationDetails?$filter=userDisplayName eq '" +
          adUser.displayName.replace("'", "''") +
          "'";
        let retry = true,
          retryCount = 1;

        while (retry && retryCount <= 5) {
          const response = await provider.apiGet(registrationDetailsPath);
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

                'User marked as signedIn: ' + userFields.Title,
                '',
                userFields,
                jobName,
                '',
                userFields.Email,
              );
              await applyTags(userFields);
              await patchSPUser(
                userFields.id,
                {
                  SignedIn: isSignedIn,
                  SignedInDate: signedInDate,
                },
                configuration,
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

          'User was not found in AD: ' + userFields.Title,
          jobName,
        );
      }
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
  }
}

async function applyTags(userFields) {
  const userMappings = mappingHelper
    .getMappings()
    .filter(
      (m) =>
        userFields.Membership?.includes(m.Membership) ||
        userFields.OtherMemberships?.includes(m.Membership),
    );

  await tagHelper.applyTags(
    userFields,
    userMappings.filter((m) => m.Tag),
    true,
  );
}

//Mark user as signedIn in sharepoint list
async function patchSPUser(userId, userData) {
  try {
    const path =
        auth.apiConfigWithSite.uri + 'lists/' + configuration.UserListId + '/items/' + userId,
      response = await provider.apiPatch(path, {
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
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

module.exports = {
  processSignedInUsers: processSignedInUsers,
};
