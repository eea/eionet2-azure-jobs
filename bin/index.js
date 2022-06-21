#!/usr/bin/env node

// read in env settings
require('dotenv').config();

const yargs = require('yargs');

const provider = require('./provider');
const auth = require('./auth');
const processor = require('./meetingProcessor');
const { config } = require('yargs');

const options = yargs
    .usage('Usage: --op <operation_name>')
    .option('op', { alias: 'operation', describe: 'operation name', type: 'string', demandOption: true })
    .argv;

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
    console.log(`You have selected: ${options.op}`);

    switch (yargs.argv['op']) {
        case 'getMeetings':
            try {

                // here we get an access token
                const authResponse = await auth.getToken(auth.tokenRequest),
                    configuration = await getConfiguration(authResponse.accessToken);

                if (configuration) {
                    await processor.processMeetings(configuration, authResponse);
                }
                else {
                    console.log("Unable to load configuration");
                }

                console.log("Meetings processing finalized");
            } catch (error) {
                console.log(error);
            }
            break;
        default:
            console.log('Select a Graph operation first');
            break;
    }
};

main();