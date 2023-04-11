#!/usr/bin/env node

// read in env settings
require('dotenv').config();

const provider = require('./src/provider');
const auth = require('./src/auth');
const meetingAttendanceProcessor = require('./src/meetingAttendanceProcessor'),
    userNamesProcessor = require('./src/userNamesProcessor'),
    signedInUsersProcessor = require('./src/signedInUsersProcessor');

async function getConfiguration(accessToken) {
    const configListId = process.env.CONFIGURATION_LIST_ID;
    let _configuration = {};
    try {
        const response = await provider.apiGet(auth.apiConfigWithSite.uri + '/lists/' + configListId + '/items?$expand=fields', accessToken);
        if (response.success) {
            response.data.value.forEach(function (item) {
                _configuration[item.fields.Title] = item.fields.Value;
            });
            return _configuration;
        }
        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
}

async function main() {
    // here we get an access token
    const authResponse = await auth.getToken(auth.tokenRequest),
        configuration = await getConfiguration(authResponse.accessToken);
    if (configuration) {
        await meetingAttendanceProcessor.processMeetings(configuration, authResponse);
        await signedInUsersProcessor.processSignedInUsers(configuration, authResponse);
        await userNamesProcessor.processUsers(configuration, authResponse);
    }
};

(async () => {
    await main();
})();