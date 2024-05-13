const logging = require('../logging'),
  provider = require('../provider'),
  auth = require('../auth');

let configuration, jobName;
function initialize(job, config) {
  (configuration = config), (jobName = job);
}

//Load AD user information
async function getADUser(userId) {
  try {
    const adResponse = await provider.apiGet(
      `${auth.apiConfig.uri}users/?$filter=id eq '${userId}'&$select=id,displayName,mail,givenName,surname,country,userType,externalUserState,externalUserStateChangeDateTime`,
    );

    if (adResponse.success && adResponse.data.value.length) {
      return adResponse.data.value[0];
    }
    return undefined;
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

async function getLookupADUserId(lookupId) {
  if (lookupId) {
    try {
      let path = auth.apiConfigWithSite.uri + 'lists/User Information List/items/' + lookupId;

      const response = await provider.apiGet(path);
      if (response.success) {
        const userInfo = response.data.fields;

        const userData = await getUserByMail(userInfo.EMail);
        if (userData) {
          return userData.id;
        }
      }

      return undefined;
    } catch (error) {
      await logging.error(configuration, error, jobName);
      return undefined;
    }
  }
  return undefined;
}

//Get AD user by email address
async function getUserByMail(email) {
  const adResponse = await provider.apiGet(
    auth.apiConfig.uri + "/users/?$filter=mail eq '" + email?.replace(/'/g, "''") + "'",
  );
  if (adResponse.success && adResponse.data.value.length) {
    return adResponse.data.value[0];
  }
  return undefined;
}

module.exports = {
  initialize: initialize,
  getADUser: getADUser,
  getLookupADUserId: getLookupADUserId,
  getUserByMail: getUserByMail,
};
