const axios = require('axios');
const provider = require('./provider');
const auth = require('./auth');

async function loadMeetings(meetingListId, authResponse) {
    try {
        const response = await provider.apiGet(auth.apiConfigWithSite.uri + 'lists/' + meetingListId + "/items?$expand=fields", authResponse.accessToken);
        if (response.success) {
            return response.data.value;
        };
        return [];
    } catch (error) {
        console.log(error)
        return [];
    }

}

async function processMeetings(configuration, authResponse) {
    const apiRoot = auth.apiConfig.uri;

    const meetings = await loadMeetings(configuration.MeetingListId, authResponse);

    try {
        meetings.forEach(async (meeting) => {
            const meetingFields = meeting.fields;

            const userId = meeting.createdBy.user.id;
            if (meetingFields.Meetinglink) {
                const meetingUrl = meetingFields.Meetinglink.Url;

                const meetingResponse = await provider.apiGet(apiRoot + 'users/' + userId + '/onlineMeetings?$filter=JoinWebUrl eq \'' + meetingUrl + '\'', authResponse.accessToken);
                if (meetingResponse.success && meetingResponse.data.value.length) {
                    const meetingId = meetingResponse.data.value[0].id;

                    const attendanceReportsResponse = await provider.apiGet(apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/attendanceReports', authResponse.accessToken);

                    if (attendanceReportsResponse.success) {
                        const reports = attendanceReportsResponse.data.value;
                        if (reports.length) {
                            reports.forEach(async (report) => {
                                const reportDetailsResponse = await provider.apiGet(apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/attendanceReports/' + report.id + '?$expand=attendanceRecords', authResponse.accessToken);
                                if (reportDetailsResponse.success) {
                                    reportDetailsResponse.data.attendanceRecords.forEach(record => {
                                        processRecord(configuration, meetingFields, record, authResponse);
                                    });
                                }
                            });
                        }
                    } else {
                        console.log(attendanceReportsResponse.error);
                        return attendanceReportsResponse.error;
                    }
                } else {
                    console.log(meetingResponse.error);
                    return meetingResponse.error;
                }

                //Mark meeting as processed
            }
        });

    } catch (error) {
        console.log(error)
        return error;
    }
};


async function processRecord(configuration, meetingFields, record, authResponse) {
    let userData = undefined,
        spUserData = undefined;
    if (record.emailAddress) {
        userData = await getUserByMail(configuration, record.emailAddress, authResponse);
        spUserData = await getSPUserByMail(configuration, record.emailAddress, authResponse);
    }

    const record2Save = {
        ParticipantName: record.identity.displayName,
        ...userData && { Countries: userData.country },
        MeetingTitle: meetingFields.Title,
        EMail: record.emailAddress,
        Participated: true
    }


};

async function getUserByMail(configuration, email, authResponse) {
    try {
        const adResponse = await provider.apiGet(auth.apiConfig.uri + "/users/?$filter=mail eq '" + email + "'", authResponse.accessToken);
        if (adResponse.success && adResponse.data.value.length) {
            return adResponse.data.value[0];
        }
        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
}

async function getSPUserByMail(configuration, email, authResponse) {
    try {
        const path = auth.apiConfigWithSite.uri + 'lists/' + configuration.UserListId + "/items?$filter=fields/Email eq '" + email + "'&$expand=fields",
            response = await provider.apiGet(path, authResponse);
        if (response.success) {
            return response.data.value[0];
        }

        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
}


module.exports = {
    processMeetings: processMeetings
};