const msal = require('@azure/msal-node');

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL Node configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: process.env.AAD_ENDPOINT + '/' + process.env.TENANT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },
};

/**
 * With client credentials flows permissions need to be granted in the portal by a tenant administrator.
 * The scope is always in the format '<resource>/.default'. For more, visit:
 * https://docs.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow
 */
const tokenRequest = {
  scopes: [process.env.GRAPH_ENDPOINT + '/.default'],
};

const apiConfig = {
  uri: process.env.GRAPH_ENDPOINT + '/beta/',
};

const apiConfigWithSite = {
  uri: process.env.GRAPH_ENDPOINT + '/beta/sites/' + process.env.SHAREPOINT_SITE_ID + '/',
};

/**
 * Initialize a confidential client application. For more info, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/initialize-confidential-client-application.md
 */
const cca = new msal.ConfidentialClientApplication(msalConfig);

async function getToken() {
  return await cca.acquireTokenByClientCredential(tokenRequest);
}

let _accessToken = undefined;
async function getAccessToken() {
  const currentDate = new Date();

  if (!_accessToken || _accessToken.expiresOn < currentDate) {
    _accessToken = await getToken(tokenRequest);
  }
  return _accessToken;
}

module.exports = {
  apiConfig: apiConfig,
  apiConfigWithSite: apiConfigWithSite,
  tokenRequest: tokenRequest,
  getAccessToken: getAccessToken,
};
