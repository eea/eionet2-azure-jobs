const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  rdfFetch = require('@rdfjs/fetch'),
  jobName = 'Obligations';

async function processObligations(configuration) {
  try {
    const instruments = await loadRDFInstruments(`${configuration.ReportingInstrumentsUrl}rdf`),
      clients = await loadRDFClients(`${configuration.ReportingClientsUrl}rdf`),
      obligations = await loadRDFObligations(`${configuration.ReportingObligationsUrl}rdf`);

    const spObligations = await loadObligations(configuration.ObligationsListId);

    const obligations2Save = mapObligations(
      configuration,
      instruments,
      clients,
      obligations,
      spObligations,
    );

    console.log('Number of obligations to update: ' + obligations2Save.length);
    for (const obligation of obligations2Save) {
      await saveObligation(configuration, obligation);
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadRDFClients(path) {
  const clients = {};

  const label = 'http://www.w3.org/2000/01/rdf-schema#label';
  return rdfFetch(path)
    .then((res) => res.dataset())
    .then((dataset) => {
      for (const quad of dataset) {
        if (quad.predicate.value === label) {
          const id = quad.subject.value.split('/').pop();
          clients[id] = quad.object.value;
        }
      }
      return clients;
    })
    .catch((err) => console.error(err));
}

async function loadRDFInstruments(path) {
  const instruments = {};

  const label = 'http://purl.org/dc/terms/title';

  return rdfFetch(path)
    .then((res) => res.dataset())
    .then((dataset) => {
      for (const quad of dataset) {
        if (quad.predicate.value === label) {
          const id = quad.subject.value.split('/').pop();
          instruments[id] = quad.object.value;
        }
      }
      return instruments;
    })
    .catch((err) => console.error(err));
}

async function loadRDFObligations(path) {
  const obligations = {};

  const label = 'http://purl.org/dc/terms/title',
    fieldRoot = 'http://rod.eionet.europa.eu/schema.rdf#';

  return rdfFetch(path)
    .then((res) => res.dataset())
    .then((dataset) => {
      for (const quad of dataset) {
        const id = quad.subject.value.split('/').pop();
        !obligations[id] && (obligations[id] = {});
        quad.predicate.value === label && (obligations[id].Title = quad.object.value);
        quad.predicate.value === `${fieldRoot}isEEAPrimary` &&
          (obligations[id].IsEEAPrimary = quad.object.value == 'true');
        quad.predicate.value === `${fieldRoot}isEEACore` &&
          (obligations[id].IsEEACore = quad.object.value == 'true');
        quad.predicate.value === `${fieldRoot}isTerminated` &&
          (obligations[id].IsTerminated = quad.object.value == 'true');
        quad.predicate.value === `${fieldRoot}isFlagged` &&
          (obligations[id].IsFlagged = quad.object.value == 'true');
        quad.predicate.value === `${fieldRoot}continuousReporting` &&
          (obligations[id].ContinuousReporting = quad.object.value == 'true');
        quad.predicate.value === `${fieldRoot}nextdeadline` &&
          (obligations[id].NextDeadline = new Date(quad.object.value));
        quad.predicate.value === `${fieldRoot}nextdeadline2` &&
          (obligations[id].NextDeadline2 = new Date(quad.object.value));
        quad.predicate.value === `${fieldRoot}comment` &&
          (obligations[id].Comment = quad.object.value);
        quad.predicate.value === `${fieldRoot}instrument` &&
          (obligations[id].InstrumentId = quad.object.value.split('/').pop());
        quad.predicate.value === `${fieldRoot}requester` &&
          (obligations[id].RequesterId = quad.object.value.split('/').pop());
        quad.predicate.value === `${fieldRoot}reportingFrequencyMonths` &&
          (obligations[id].ReportingFrequencyMonths = quad.object.value);
      }

      return obligations;
    })
    .catch((err) => console.error(err));
}

async function loadObligations(obligationsListId) {
  const response = await provider.apiGet(
    `${auth.apiConfigWithSite.uri}lists/${obligationsListId}/items?$expand=fields&$top=999`,
  );
  if (response.success) {
    return response.data.value;
  } else {
    return [];
  }
}

function mapObligations(configuration, instruments, clients, obligations, spObligations) {
  const result = [],
    currentDate = new Date(new Date().toDateString());

  for (const [id, obligation] of Object.entries(obligations)) {
    const existingObligation = spObligations.find((o) => o.fields.SourceId == id),
      obligation2Save = {};

    obligation2Save.Title = obligation.Title;
    obligation2Save.Url = `${configuration.ReportingObligationsUrl}${id}`;
    obligation2Save.Instrument = instruments[obligation.InstrumentId];
    obligation2Save.InstrumentUrl = `${configuration.ReportingInstrumentsUrl}${obligation.InstrumentId}`;
    obligation2Save.ReportTo = clients[obligation.RequesterId];
    obligation2Save.ReportToUrl = `${configuration.ReportingClientsUrl}${obligation.RequesterId}`;
    obligation2Save.SourceId = id;
    !Number.isNaN(obligation.ReportingFrequencyMonths) &&
      (obligation2Save.ReportingFrequencyMonths = Number.parseInt(
        obligation.ReportingFrequencyMonths,
      ));
    if (
      obligation.Deadline < currentDate &&
      obligation2Save.ReportingFrequencyMonths === 0 &&
      obligation.NextDeadline2
    ) {
      obligation2Save.Deadline = obligation.NextDeadline2;
    } else {
      obligation2Save.Deadline = obligation.NextDeadline;
    }
    obligation2Save.ContinuousReporting = obligation.ContinuousReporting;
    obligation2Save.Comment = obligation.Comment;
    obligation2Save.IsTerminated = obligation.IsTerminated;
    obligation2Save.IsEEAPrimary = obligation.IsEEAPrimary;
    obligation2Save.IsEEACore = obligation.IsEEACore;
    obligation2Save.IsFlagged = obligation.IsFlagged;

    existingObligation && (obligation2Save.id = existingObligation.id);
    result.push(obligation2Save);
  }
  return result;
}

async function saveObligation(configuration, obligation) {
  try {
    let path = `${auth.apiConfigWithSite.uri}lists/${configuration.ObligationsListId}/items`,
      response;
    if (obligation.id) {
      path += `/${obligation.id}`;
      delete obligation.id;

      response = await provider.apiPatch(path, {
        fields: obligation,
      });
    } else {
      response = await provider.apiPost(path, {
        fields: obligation,
      });
    }
    if (response.success) {
      return response.data;
    } else {
      throw response?.error;
    }
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

module.exports = {
  processObligations: processObligations,
};
