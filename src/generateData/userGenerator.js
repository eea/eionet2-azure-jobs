const generateDataHelper = require('./generateDataHelper');

const auth = require('../auth');
const provider = require('../provider');

const NO_OF_USERS = 4000;

async function postUser(index, country, organisation, authResponse, configuration, memberships) {
  let userData = {
    FirstName: 'User',
    LastName: 'No.' + index,
    Email: 'user' + index + '@mail.com',
    Country: country,
    Organisation: organisation,
  };
  userData.DisplayName =
    userData.FirstName + ' ' + userData.LastName + ' (' + userData.Country + ')';

  const invitationResponse = await postInvitation(userData, authResponse);

  if (invitationResponse.success) {
    const userId = invitationResponse.data.invitedUser.id;
    const adResponse = await patchAdUser(userData, userId, authResponse);
    userData.ADUserId = userId;

    if (adResponse.success) {
      const spResponse = await postSpUser(userData, authResponse, configuration, memberships);
    }
  }
}

async function postInvitation(user, authResponse) {
  const path = auth.apiConfig.uri + '/invitations';

  const response = await provider.apiPost(path, authResponse.accessToken, {
    invitedUserEmailAddress: user.Email,
    invitedUserDisplayName: user.DisplayName,
    inviteRedirectUrl: 'http://wwww.example.com',
    sendInvitationMessage: true,
  });

  return response;
}

async function patchAdUser(user, userId, authResponse) {
  const path = auth.apiConfig.uri + '/users/' + userId;

  const response = await provider.apiPatch(path, authResponse.accessToken, {
    givenName: user.FirstName,
    surname: user.LastName,
    displayName: user.DisplayName,
    department: 'Eionet',
    country: user.Country,
  });

  return response;
}

async function postSpUser(user, authResponse, configuration, memberships) {
  const graphPath = auth.apiConfigWithSite.uri + 'lists/' + configuration.UserListId + '/items';
  const membershipIndex = Math.floor(Math.random() * (memberships.length + 1));

  const record2Save = {
    fields: {
      Title: user.DisplayName,
      Email: user.Email,
      'Membership@odata.type': 'Collection(Edm.String)',
      Membership: memberships.slice(membershipIndex),
      'OtherMemberships@odata.type': 'Collection(Edm.String)',
      OtherMemberships: ['ETC-ST'],
      OrganisationLookupId: user.Organisation.Id,
      Phone: Math.random().toString().slice(2, 11),
      ADUserId: user.ADUserId,
      Gender: 'Sir.',
      LastInvitationDate: new Date(),
      Country: user.Country,
    },
  };

  console.log(JSON.stringify(record2Save));
  await provider.apiPost(graphPath, authResponse.accessToken, record2Save);
}

async function generateUsers(configuration, authResponse) {
  const graphPath = auth.apiConfigWithSite.uri + 'lists/' + configuration.UserListId + '/items',
    countries = await generateDataHelper.getCountries(configuration, authResponse),
    memberships = await generateDataHelper.getUsersGroups(configuration, authResponse);

  for (let i = 3400; i < NO_OF_USERS; i++) {
    const countryIndex = Math.floor(Math.random() * (countries.length - 2) + 1),
      country = countries[countryIndex];

    const organisations = await generateDataHelper.getOrganisations(
      configuration,
      authResponse,
      country,
    );

    const organisationIndex = Math.floor(Math.random() * (organisations.length - 2) + 1),
      organisation = organisations[organisationIndex];

    await postUser(i, country, organisation, authResponse, configuration, memberships);
  }
}

module.exports = {
  generateUsers: generateUsers,
};
