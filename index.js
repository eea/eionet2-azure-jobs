#!/usr/bin/env node

// read in env settings
require('dotenv').config();

const provider = require('./src/provider');
const auth = require('./src/auth');
const meetingAttendanceProcessor = require('./src/meetingAttendanceProcessor'),
    meetingFieldsProcessor = require('./src/meetingFieldsProcessor'),
    userNamesProcessor = require('./src/userNamesProcessor'),
    signedInUsersProcessor = require('./src/signedInUsersProcessor'),
    consultationRespondantsProcessor = require('./src/consultationRespondantsProcessor');

async function getConfiguration() {
    const configListId = process.env.CONFIGURATION_LIST_ID;
    let _configuration = {};
    try {
        const response = await provider.apiGet(auth.apiConfigWithSite.uri + '/lists/' + configListId + '/items?$expand=fields');
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
    const configuration = await getConfiguration();
    if (configuration) {
        process.env.RUN_MEETING_ATTENDANCE_JOB === 'true' && await meetingAttendanceProcessor.processMeetings(configuration);
        process.env.RUN_SIGN_IN_USERS_JOB === 'true' && await signedInUsersProcessor.processSignedInUsers(configuration);
        process.env.RUN_USER_NAMES_JOB === 'true' && await userNamesProcessor.processUsers(configuration);
        process.env.RUN_CONSULTATION_RESPONDANTS_JOB === 'true' && await consultationRespondantsProcessor.processConsultations(configuration);
        process.env.RUN_MEETING_FIELDS_JOB === 'true' && await meetingFieldsProcessor.processMeetings(configuration, false);
        process.env.RUN_MEETING_FIELDS_JOB_ALL === 'true' && await meetingFieldsProcessor.processMeetings(configuration, true);
    }
};

(async () => {
    await main();
})();