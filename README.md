# eionet2-azure-jobs

[![GitHub release](https://img.shields.io/github/v/release/eea/eionet2-azure-jobs)](https://github.com/eea/eionet2-azure-jobs/releases)

This Eionet 2.0 application implements the following features:
- Retrieve the meeting information from a Sharepoint list (Meetings List)
- Use the meeting information to query the meeting participation on behalf of the meeting organiser
- Create meeting statistics in the meeting participants list

The app is available to the designated Eionet Admin roles.

## Getting started

The application is build as a JavaScript application that is scheduled to be executed automatically at the designated interval through Azure (like a "cron" job).
When a meeting is processed the applications retrieves the meeting participants using Graph API automatically, prepares the ouptput data and store it in SharePoint. The application exchanges data with the EEA Azure tenant to match the users with their Eionet specific information stored in SharePoint.
The output information is used for various reports, such as NFP dashboard and statistics.

## Configuration file.

The application has a .env file that needs to configured locally. See the details below for file structure:

    # After registering the app in Azure (App registrations) fill the fields below with appropiate values
    TENANT_ID= 
    CLIENT_ID=
    # Generate Client Secret. This is the "value" of the secret
    CLIENT_SECRET=
    # Endpoints
    AAD_ENDPOINT=https://login.microsoftonline.com
    GRAPH_ENDPOINT=https://graph.microsoft.com
    SHAREPOINT_SITE_ID= # Site ID of the -EXT-EionetConfiguration Site - with the lists
    SECONDARY_SHAREPOINT_SITE_ID=  # Site ID of the site with the Individual consultation lists -EXT-Eionet
    CONFIGURATION_LIST_ID= # The configuration list ID, stored in the -EXT-EionetConfiguration Site

The second part of the file will contain the keys of the jobs that are configured to run in the format {Key}=true if the job should run or {Key}=false otherwise. A key must be present only once. Removing the key has the same effect as setting it to false. The keys can be found in the Jobs sections below.

    RUN_MEETING_ATTENDANCE_JOB=true 
    RUN_USER_NAMES_JOB=false 
    RUN_SIGN_IN_USERS_JOB=true 


## Jobs

### Meeting attendance job
Processes meetings and extracts the participants from the Graph API attendance records. Saves the participants in the Event participants list.

    Filters: (Processed = 0 AND MeetingStart <= Current time) OR (Processed = 1 AND MeetingEnd >= (Current time - 12 hours))
    Config key: RUN_MEETING_ATTENDANCE_JOB

### Meeting fieds job
Updates fields MeetingLink, NoOfParticipants, NoOfRegistered, Countries based on MeetingJoinId and information from participants list.

    Filters: MeetingStart <= (Current time - 4 weeks)
    Config key: RUN_MEETING_FIELDS_JOB

### Meeting fieds job all
Updates fields MeetingLink, NoOfParticipants, NoOfRegistered, Countries based on MeetingJoinId and information from participants list.

    Filters: none (loads all meetings)
    Config key: RUN_MEETING_FIELDS_JOB_ALL

### User names job
Updates user display names to include Country and NFP role if present. After update the user display name will have the following format: *John Doe (DE)* or *Jane Doe (NFP-FR)*

    Filters: SignedIn = 1 and SignedDate >= (Current time - 30 days)
    Config key: RUN_USER_NAMES_JOB
 
### Signed in users job
Updates the SignedIn field to true for users that have finalized sigining in. The information is taken from isMfaRegistered field in Graph API credentialUserRegistrationDetails report.
**For the moment requires the beta endpoint of the Graph API**

    Filters: SignedIn = 0 and SignedIn = null
    Config key : RUN_SIGN_IN_USERS_JOB

### Consultation respondants job
Updates Respondants field on the consultation list. Each consultation has a reference to a list in the SECONDARY_SHAREPOINT_SITE_ID. From that list the countries are taken and updated in the Respondants field.

    Filters: ConsultationListId not null and StartDate <= Current time and Closed >= Current time
    Config key : RUN_CONSULTATION_RESPONDANTS_JOB

### Obligations job
Updates entire Reporting Obligations Table from ROD database.

    Filters: None
    Config key : RUN_OBLIGATIONS_JOB

### User membership job
Updated user group memberships and tags based on data in User sharepoint list. If UpdatedAllTags is set to true in Configuration list then all tags are checked and corrected. If not only tags related to groups that are corrected will be applied.

    Filters: SignedIn eq 1
    Config key : RUN_USER_MEMBERSHIPS_JOB

### Remove tags job
Removes specified tags from user that have not yet finalized the signing in process. For the moment the tags that need to be removed are hardcoded in the job's code.

    Filters: SignedIn = 0 and SignedIn = null
    Config key : RUN_REMOVE_USER_TAGS

## Release

See [RELEASE.md](https://github.com/eea/eionet2-azure-jobs/blob/master/RELEASE.md).

## How to contribute

For now the contributions are not open outside the internal EEA project team.

## Copyright and license

The Initial Owner of the Original Code is [European Environment Agency (EEA)](http://eea.europa.eu).
All Rights Reserved.

See [LICENSE.md](https://github.com/eea/eionet2-user-management/blob/master/LICENSE.md) for details.
