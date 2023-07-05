const logging = require('./logging'),
  provider = require('./provider'),
  auth = require('./auth'),
  date = require('date-and-time'),
  jobName = 'ConsultationRespondants';

//Entry-point function for processing consultation respondants
let noOfUpdateRecords = 0;
async function processConsultations(configuration) {
  try {
    const consultations = await loadConsulations(configuration.ConsultationListId);
    console.log('Number of consultations for respondants loaded: ' + consultations.length);
    for (const consultation of consultations) {
      await processConsultation(consultation, configuration);
    }

    console.log('Updated ' + noOfUpdateRecords + ' running consultations');
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return error;
  }
}

async function loadConsulations(listId) {
  const filterDate = date.format(new Date(), 'YYYY-MM-DD');

  let path = encodeURI(
    auth.apiConfigWithSite.uri +
      'lists/' +
      listId +
      "/items?$expand=fields&$top=999&$filter=fields/ConsultationListId ne null and fields/Startdate le '" +
      filterDate +
      "' and fields/Closed ge '" +
      filterDate +
      "'",
  );
  let result = [];

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

async function processConsultation(consultation, configuration) {
  const consultationFields = consultation.fields;

  const countries = await getCountries(configuration, consultationFields);
  if (countries.length) {
    await patchConsultation(consultation.id, consultationFields.Title, countries, configuration);
  }
}

async function getCountries(configuration, consultation) {
  let allowedCountries = [];
  allowedCountries = await getAllowedCountries(configuration);

  let result = [];

  if (consultation.ConsultationListId) {
    const path =
      auth.apiConfigWithSecondarySite.uri +
      'lists/' +
      consultation.ConsultationListId +
      '/items?$expand=fields';

    const response = await provider.apiGet(path, true);
    if (response.success) {
      if (response.data.value.length) {
        const firstRecord = response.data.value[0];
        if (!Object.prototype.hasOwnProperty.call(firstRecord.fields, 'Country')) {
          await logging.info(
            configuration,
            consultation.Title +
              ': Cannot find column "Country" in specified list ' +
              consultation.ConsultationListId,
            '',
            {},
            jobName,
          );
        } else {
          const countryList = response.data.value
            .map((record) => record.fields.Country)
            .filter((c) => allowedCountries.includes(c));
          result = [...new Set(countryList)];
        }
      }
    } else {
      await logging.info(
        configuration,
        consultation.Title +
          ': List with the specified ID does not exist ' +
          consultation.ConsultationListId,
        '',
        {},
        jobName,
      );
    }
  }

  return result;
}

async function getAllowedCountries(configuration) {
  const response = await provider.apiGet(
    auth.apiConfigWithSite.uri + '/lists/' + configuration.ConsultationListId + '/columns',
  );
  const columns = response.data.value;

  const countryColumn = columns.find((column) => column.name === 'Respondants');
  if (countryColumn && countryColumn.choice) {
    return countryColumn.choice.choices;
  }

  return [];
}

//Update respondants field on consultation
async function patchConsultation(consultationId, consultationTitle, countries, configuration) {
  try {
    const path =
        auth.apiConfigWithSite.uri +
        'lists/' +
        configuration.ConsultationListId +
        '/items/' +
        consultationId,
      response = await provider.apiPatch(path, {
        fields: {
          'Respondants@odata.type': 'Collection(Edm.String)',
          Respondants: countries,
        },
      });
    if (response.success) {
      console.log(
        'Consultation updated succesfully : ' + consultationTitle + ' ' + countries.join(','),
      );
      noOfUpdateRecords++;
      return response.data;
    }

    return undefined;
  } catch (error) {
    await logging.error(configuration, error, jobName);
    return undefined;
  }
}

module.exports = {
  processConsultations: processConsultations,
};
