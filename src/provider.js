const axios = require('axios');
const auth = require('./auth');

async function apiGet(endpoint, skipEncoding) {
  const token = await auth.getAccessToken();
  const options = {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  try {
    const response = await axios.default.get(
      skipEncoding ? endpoint : encodeURI(endpoint),
      options,
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(JSON.stringify(error));
    return {
      success: false,
      error: error,
    };
  }
}

async function apiPost(endpoint, data) {
  const token = await auth.getAccessToken();
  const options = {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  try {
    const response = await axios.default.post(encodeURI(endpoint), data, options);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(JSON.stringify(error));
    return {
      success: false,
      error: error,
    };
  }
}

async function apiPatch(endpoint, data) {
  const token = await auth.getAccessToken();
  const options = {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  try {
    const response = await axios.default.patch(encodeURI(endpoint), data, options);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.log(JSON.stringify(error));
    return {
      success: false,
      error: error,
    };
  }
}

module.exports = {
  apiGet: apiGet,
  apiPost: apiPost,
  apiPatch: apiPatch,
};
