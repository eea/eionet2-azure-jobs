const axios = require('axios');
const provider = require('./provider');
const auth = require('./auth');


async function processMeetings(configuration, authResponse) {
    const meetings = await loadMeetings(configuration.MeetingListId, authResponse);

    try {
        meetings.forEach(async (meeting) => {
            await processMeeting(meeting, configuration, authResponse)
        });

    } catch (error) {
        console.log(error)
        return error;
    }
};

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
};

async function processMeeting(meeting, configuration, authResponse) {
    const apiRoot = auth.apiConfig.uri,
        meetingFields = meeting.fields;

    const userId = meeting.createdBy.user.id;
    if (meetingFields.Meetinglink) {
        const meetingUrl = meetingFields.Meetinglink.Url,
            meetingResponse = await provider.apiGet(apiRoot + 'users/' + userId + '/onlineMeetings?$filter=JoinWebUrl eq \'' + meetingUrl + '\'', authResponse.accessToken),
            processedReports = meetingFields.Processedreports ? meetingFields.Processedreports.split('#') : [];

        if (meetingResponse.success && meetingResponse.data.value.length) {
            const meetingId = meetingResponse.data.value[0].id;

            const attendanceReportsResponse = await provider.apiGet(apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/attendanceReports', authResponse.accessToken);

            if (attendanceReportsResponse.success) {
                const reports = attendanceReportsResponse.data.value;
                let reportProcessedYN = true;

                if (reports.length) {
                    const filteredReports = reports.filter(report => {
                        return !processedReports.includes(report.id);
                    });
                    if (filteredReports && filteredReports.length) {
                        for (const report of filteredReports) {
                            const reportDetailsResponse = await provider.apiGet(apiRoot + 'users/' + userId + '/onlineMeetings/' + meetingId + '/attendanceReports/' + report.id + '?$expand=attendanceRecords', authResponse.accessToken);
                            if (reportDetailsResponse.success) {
                                for (const record of reportDetailsResponse.data.attendanceRecords) {
                                    const result = await processRecord(configuration, meetingFields, record, authResponse.accessToken);
                                    reportProcessedYN = reportProcessedYN && result;
                                };

                                //Add reportId to processed list
                                reportProcessedYN && processedReports.push(report.id);
                                reportProcessedYN = true;
                            };
                        }

                        //Mark meeting as processed
                        await patchMeeting(meetingFields.id, processedReports, configuration, authResponse.accessToken);
                    }

                } else {
                    console.log(attendanceReportsResponse.error);
                    return attendanceReportsResponse.error;
                }
            } else {
                console.log(meetingResponse.error);
                return meetingResponse.error;
            }
        }
    }
};


async function processRecord(configuration, meetingFields, record, accessToken) {
    let userData = undefined,
        spUserData = undefined;

    try {
        if (record.emailAddress) {
            userData = await getUserByMail(configuration, record.emailAddress, accessToken);
            spUserData = await getSPUserByMail(configuration, record.emailAddress, accessToken);
        }

        const existingParticipant = await getParticipant(configuration, meetingFields.id, record.emailAddress, record.identity.displayName, accessToken);

        if (!existingParticipant) {
            const record2Save = {
                fields: {
                    Participantname: record.identity.displayName,
                    ...userData && { Countries: userData.country },
                    MeetingtitleLookupId: meetingFields.id,
                    EMail: record.emailAddress,
                    Participated: true,
                    ...userData && { 'EionetGroup@odata.type': 'Collection(Edm.String)' },
                    ...userData && { EionetGroup: spUserData.fields.Membership },
                }
            }

            const path = auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingPartcipantsListId + "/items",
                response = await provider.apiPost(path, accessToken, record2Save);

            return response.success;
        } else {
            return true;
        }
    }
    catch (err) {
        console.log(err);
        return false;
    }
};

async function getUserByMail(configuration, email, accessToken) {
    try {
        const adResponse = await provider.apiGet(auth.apiConfig.uri + "/users/?$filter=mail eq '" + email + "'", accessToken);
        if (adResponse.success && adResponse.data.value.length) {
            return adResponse.data.value[0];
        }
        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
};

async function getSPUserByMail(configuration, email, accessToken) {
    try {
        const path = auth.apiConfigWithSite.uri + 'lists/' + configuration.UserListId + "/items?$filter=fields/Email eq '" + email + "'&$expand=fields",
            response = await provider.apiGet(path, accessToken);
        if (response.success) {
            return response.data.value[0];
        }

        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
};

async function getParticipant(configuration, meetingId, email, name, accessToken) {
    try {
        let path = auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingPartcipantsListId + "/items?$filter=fields/MeetingtitleLookupId eq " + meetingId + "&fields/";
        if (email) {
            path += "EMail eq '" + email + "'";
        } else {
            path += "Participantname eq '" + name + "'";
        }

        response = await provider.apiGet(path, accessToken);
        if (response.success) {
            return response.data.value[0];
        }

        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
};

async function patchMeeting(meetingId, processedReports, configuration, accessToken) {
    try {
        const path = auth.apiConfigWithSite.uri + 'lists/' + configuration.MeetingListId + "/items/" + meetingId,
            response = await provider.apiPatch(path, accessToken, {
                fields: {
                    Processedreports: processedReports.join("#")
                }
            });
        if (response.success) {
            return response.data;
        }

        return undefined;
    } catch (err) {
        console.log(err);
        return undefined;
    }
};


module.exports = {
    processMeetings: processMeetings
};