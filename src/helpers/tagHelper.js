const logging = require('../logging'),
  provider = require('../provider'),
  auth = require('../auth');

const countryMappingHelper = require('./countryMappingHelper');

let configuration, jobName;
async function initialize(job, config) {
  (configuration = config), (jobName = job);

  await countryMappingHelper.initialize(configuration);
}

async function addTag(teamId, name, userId, email) {
  let response = await provider.apiGet(
    `${auth.apiConfig.uri}/teams/${teamId}/tags?$filter=displayName eq '${name}'`,
  );

  let postResponse;

  if (response?.success && response?.data?.value?.length) {
    const existingTag = response.data.value[0],
      tagMemberIdResponse = await getTag(teamId, existingTag.id, userId);

    if (!tagMemberIdResponse?.data?.value?.length) {
      postResponse = await provider.apiPost(
        `${auth.apiConfig.uri}/teams/${teamId}/tags/${existingTag.id}/members`,
        {
          userId: userId,
        },
      );
    }
  } else {
    postResponse = await provider.apiPost(`${auth.apiConfig.uri}/teams/${teamId}/tags/`, {
      displayName: name,
      members: [
        {
          userId: userId,
        },
      ],
    });
  }

  if (postResponse) {
    const message = postResponse.success
      ? `The tag ${name} was applied succesfully for user with email ${email}.`
      : `Applying the tag ${name} for user with email ${email} returned an error. Please check the tag.`;

    await logging.info(configuration, message, '', {}, jobName);
  }
}

async function getTag(teamId, tagId, userId) {
  //endpoint returns 404 Not Found if user doesn't have the tag. Error is logged in logging list.
  const response = await provider.apiGet(
    `${auth.apiConfig.uri}/teams/${teamId}/tags/${tagId}/members?$filter=userId eq '${userId}'`,
  );

  return response;
}

async function applyTags(userFields, tagMappings, applyNFP) {
  if (!configuration) {
    return;
  }

  const userId = userFields.ADUserId;
  if (!userId) {
    return;
  }

  const countryName = countryMappingHelper.getCountryName(userFields.Country);
  for (const m of tagMappings) {
    await addTag(m.O365GroupId, m.Tag, userId, userFields.Email);
    await addTag(m.O365GroupId, countryName, userId, userFields.Email);
  }

  //check and add nfp tag
  if (userFields.NFP && applyNFP) {
    await addTag(
      configuration.MainEionetGroupId,
      'National-Focal-Points',
      userId,
      userFields.Email,
    );
    await addTag(configuration.MainEionetGroupId, countryName, userId, userFields.Email);
  }
}

module.exports = {
  initialize: initialize,
  applyTags: applyTags,
};
