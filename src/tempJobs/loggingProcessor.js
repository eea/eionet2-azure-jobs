const logging = require('../logging'),
  provider = require('../provider'),
  auth = require('../auth'),
  jobName = 'LogsProcessor';

async function processLogs(configuration) {
  try {
    const logs = await loadLogs(configuration);

    console.log(`Number of log records loaded: ${logs.length}`);
    for (const logRecord of logs) {
      processLog(logRecord, configuration);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadLogs(configuration) {
  let path = encodeURI(
      `${auth.apiConfigWithSite.uri}lists/${configuration.LoggingListId}/items?$expand=fields&$top=999&$filter=(fields/Action eq 'Add user' or fields/Action eq 'Edit user' or fields/Action eq 'Remove user') and fields/AffectedUser eq null`,
    ),
    result = [];

  while (path) {
    const response = await provider.apiGet(path, true);
    if (response.success) {
      result = result.concat(response.data.value);
      path = response.data['@odata.nextLink'];
    } else {
      path = undefined;
    }
  }

  return result;
}

async function processLog(logRecord, configuration) {
  const logFields = logRecord.fields;

  const values = logFields.Title?.split(':');

  let affectedUser;
  if (values.length == 2) {
    affectedUser = values[1].trim();
  } else {
    const data = JSON.parse(logFields.ApiData);
    data?.Email && (affectedUser = data.Email);
  }

  if (affectedUser) {
    let path = `${auth.apiConfigWithSite.uri}lists/${configuration.LoggingListId}/items`;
    if (logRecord.id) {
      path += `/${logRecord.id}`;

      await provider.apiPatch(path, {
        fields: {
          AffectedUser: affectedUser,
        },
      });
    }
  }
}

module.exports = {
  processLogs: processLogs,
};
