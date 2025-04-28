const logging = require('./logging'),
  provider = require('./provider'),
  utils = require('./helpers/utils'),
  auth = require('./auth'),
  axios = require('axios'),
  jobName = 'Reportnet3Flows';

async function processFlows(configuration) {
  try {
    console.log('Flow update started');
    const countries = await getCountries(configuration),
      spFlows = await loadFlows(configuration.ReportnetFlowsListId);

    let flowCount = 0,
      flows = [];

    for (const country of countries) {
      const result = await loadReportnetFlows(configuration, country);

      result.forEach((item) => (item.country = country));

      flows.push(...result);
      flowCount += result.length;
      console.log(`Number of data flows loaded for country ${country} :` + result.length);
    }

    const flows2Save = mapFlows(flows, spFlows);
    for (const flow of flows2Save) {
      await saveFlow(configuration, flow);
    }

    const flows2Remove = spFlows.map((spFlow) => {
      if (
        !flows.find(
          (flow) => flow.id == spFlow.fields.DataflowId && flow.country == spFlow.fields.Country,
        )
      )
        return spFlow;
    }).filter(df => !!df);
    for (const flow of flows2Remove) {
      await removeFlow(configuration, flow);
    }

    console.log('Total number of data flows updated: ' + flowCount);
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function getCountries(configuration) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + '/lists/' + configuration.UserListId + '/columns',
  );
  const columns = response.data.value;

  const countryColumn = columns.find((column) => column.name === 'Country');
  if (countryColumn?.choice) {
    return countryColumn.choice.choices;
  }

  return [];
}

async function loadReportnetFlows(configuration, country) {
  const authorizationKey = process.env['REACT_APP_REPORTNET3_KEY'];

  const pageSize = 20,
    dataflows = [];
  let url = `${configuration.Reportnet3DataflowUrl}${country}?asc=0&pageNum=0&pageSize=${pageSize}&key=${authorizationKey}`;

  try {
    let response = await axios.default.request({
      method: 'post',
      url: url,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response?.data?.totalRecords > 0) {
      dataflows.push(...response.data.dataflows);
      const noOfPages = Math.ceil(response.data.totalRecords / pageSize);
      let pageNo = 1;

      while (pageNo <= noOfPages) {
        url = `${configuration.Reportnet3DataflowUrl}${country}?asc=0&pageNum=${pageNo}&pageSize=${pageSize}&key=${authorizationKey}`;
        response = await axios.default.request({
          method: 'post',
          url: url,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        dataflows.push(...response.data.dataflows);
        pageNo++;
      }
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
  }

  return dataflows;
}

async function loadFlows(listId) {
  const response = await provider.apiGet(
    `${auth.apiConfigWithSite.uri}lists/${listId}/items?$expand=fields&$top=999`,
  );
  if (response.success) {
    return response.data.value;
  } else {
    return [];
  }
}

function mapFlows(flows, spFlows) {
  return flows.map((flow) => {
    const obligation = flow.obligation;
    let emails = [];

    flow.representatives.forEach((rpr) => {
      emails.push(...rpr.leadReporters.map((lr) => lr.email));
    });
    emails = [...new Set(emails.filter((e) => !!e))];

    const releasedDates = flow.releasedDates
      .filter((rd) => !!rd)
      .sort((a, b) => a - b)
      .map((rDate) => new Date(rDate)),
      firstReleaseDate = releasedDates?.length ? releasedDates[0] : undefined,
      lastReleaseDate =
        releasedDates?.length > 1 ? releasedDates[releasedDates.length - 1] : undefined;

    const spFlow = spFlows.find(
      (spl) => spl.fields.DataflowId == flow.id && spl.fields.Country == flow.country,
    );
    return {
      id: spFlow?.id,
      Country: flow.country,
      DataflowId: flow.id,
      DataflowName: flow.name,
      DataflowURL: flow.dataflowLink,
      ObligationName: obligation?.oblTitle,
      ObligationURL: obligation?.obligationLink,
      LegalInstrumentName: obligation?.legalInstrument?.sourceAlias,
      LegalInstrumentURL: obligation?.legalInstrument?.legalInstrumentLink,
      ...(flow.deadlineDate && { DeadlineDate: new Date(flow.deadlineDate) }),
      Status: utils.capitalize(flow.status),
      ReporterEmails: emails.join(', '),
      FirstReleaseDate: firstReleaseDate,
      LastReleaseDate: lastReleaseDate,
      DeliveryStatus: utils.capitalize(
        flow.reportingDatasets?.sort((a, b) => b.creationDate - a.creationDate)[0]?.status,
      ),
    };
  });
}

async function saveFlow(configuration, flow) {
  let path = `${auth.apiConfigWithSite.uri}lists/${configuration.ReportnetFlowsListId}/items`,
    response;
  if (flow.id) {
    path += `/${flow.id}`;
    delete flow.id;

    response = await provider.apiPatch(path, {
      fields: flow,
    });
  } else {
    response = await provider.apiPost(path, {
      fields: flow,
    });
  }
}

async function removeFlow(configuration, spFlow) {
  let path = `${auth.apiConfigWithSite.uri}lists/${configuration.ReportnetFlowsListId}/items`;
  if (spFlow.id) {
    path += `/${spFlow.id}`;

    await provider.apiDelete(path);
    console.log(`Data flow ${spFlow.fields.DataflowName} was removed`);
  }
}

module.exports = {
  processFlows: processFlows,
};
