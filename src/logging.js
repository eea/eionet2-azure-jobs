const axios = require('axios'),
  auth = require('./auth');

async function info(
  configuration,
  accessToken,
  message,
  apiPath,
  data,
  jobName
) {
  console.log(message);
  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  let fields = {
    fields: {
      ApplicationName: jobName || 'Eionet2-Azure-Jobs',
      ApiPath: apiPath,
      ApiData: JSON.stringify(data),
      Title: message,
      Logtype: 'Info',
      Timestamp: new Date(),
    },
  };
  const path =
    auth.apiConfigWithSite.uri +
    'lists/' +
    configuration.LoggingListId +
    '/items';

  try {
    const response = await axios.default.post(path, fields, options);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: error,
    };
  }
}

async function error(configuration, accessToken, error, jobName) {
  console.log(error);
  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  let fields = {
    fields: {
      ApplicationName: jobName || 'Eionet2-Azure-Jobs',
      ApiData: JSON.stringify(error),
      Title: error.toString(),
      Logtype: 'Error',
      Timestamp: new Date(),
    },
  };
  const path =
    auth.apiConfigWithSite.uri +
    'lists/' +
    configuration.LoggingListId +
    '/items';

  try {
    const response = await axios.default.post(path, fields, options);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: error,
    };
  }
}

module.exports = {
  info: info,
  error: error,
};
