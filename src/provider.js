const axios = require('axios');

async function apiGet(endpoint, accessToken, skipEncoding) {
  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

async function apiPost(endpoint, accessToken, data) {
  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

async function apiPatch(endpoint, accessToken, data) {
  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
