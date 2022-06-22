const axios = require('axios');

async function apiGet(endpoint, accessToken) {

    const options = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

    //console.log('request made to web API at: ' + new Date().toString());

    try {
        const response = await axios.default.get(endpoint, options);
        return {
            success: true,
            data: response.data
        }
            ;
    } catch (error) {
        console.log(error)
        return {
            success: false,
            error: error
        }
    }
};

async function apiPost(endpoint, accessToken, data) {

    const options = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

    try {
        const response = await axios.default.post(endpoint, data, options);
        return {
            success: true,
            data: response.data
        }
            ;
    } catch (error) {
        console.log(error)
        return {
            success: false,
            error: error
        }
    }
};


async function apiPatch(endpoint, accessToken, data) {

    const options = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

    try {
        const response = await axios.default.patch(endpoint, data, options);
        return {
            success: true,
            data: response.data
        }
            ;
    } catch (error) {
        console.log(error)
        return {
            success: false,
            error: error
        }
    }
};

module.exports = {
    apiGet: apiGet,
    apiPost: apiPost,
    apiPatch: apiPatch
};