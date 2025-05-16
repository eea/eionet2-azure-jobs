# eionet2-azure-jobs

[![GitHub release](https://img.shields.io/github/v/release/eea/eionet2-azure-jobs)](https://github.com/eea/eionet2-azure-jobs/releases)



## Getting started

The application is build as a JavaScript application that is scheduled to be executed automatically at the designated interval through Azure (like a "cron" job).
When a meeting is processed the applications retrieves the meeting participants using Graph API automatically, prepares the ouptput data and store it in SharePoint. The application exchanges data with the EEA Azure tenant to match the users with their Eionet specific information stored in SharePoint.
The output information is used for various reports, such as Eionet dashboard and statistics.

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

### Meeting attendance job - every 3 hours
Processes meetings from the "Events list" and extracts the participants from the Graph API attendance records. Saves the participants in the *Event participants list*.
It either goes through those events which have **not** been processed before, as well as those which have already been processed and where the meeting end date is less than 12 hours ago. 
THis is to capture a) Older meetings, which have not been captured by the script, e.g. because it did not run regularly b) To capture participants in e.g. multi-day meetings where the initial attendance whcih was covered is not the final one 

    Filters: (Processed = 0 AND MeetingStart <= Current time) OR (Processed = 1 AND MeetingEnd >= (Current time - 12 hours))
    Config key: RUN_MEETING_ATTENDANCE_JOB

### Meeting fields job -  every 10 min
This job updates several fields in the "Events list". It runs on all future meetings as well as those in the past 8 weeks. 
This is to a) generate the "MeetingLink" from the ID for future meetings, and update the figures of participants, registrants and countries based on the "Participants list"
Updates fields in the Events listÆ *MeetingLink, NoOfParticipants, NoOfRegistered, Countries* based on MeetingJoinId and information from participants list.
This job can run very freqently

    Filters: MeetingStart <= (Current time - 4 weeks)
    Config key: RUN_MEETING_FIELDS_JOB

### User names job - every 5 hours
Updates user display names in EEA Azure AD to include Country and NFP role if present. After update the user display name will have the following format: *John Doe (DE)* or *Jane Doe (NFP-FR)*

    Filters: SignedIn = 1 and SignedDate >= (Current time - 30 days)
    Config key: RUN_USER_NAMES_JOB
 
### Signed in users job - every 5 hours
Updates the *SignedIn* field to true for users that have finalized sigining in. The information is taken from isMfaRegistered field in Graph API credentialUserRegistrationDetails report.
**For the moment requires the beta endpoint of the Graph API**

    Filters: SignedIn = 0 and SignedIn = null
    Config key : RUN_SIGN_IN_USERS_JOB

### Consultation respondants job - every 3 hours
Updates *Respondants* field on the consultation list. Each consultation has a reference to a list in the SECONDARY_SHAREPOINT_SITE_ID. From that list the countries are taken and updated in the Respondants field.

    Filters: ConsultationListId not null and StartDate <= Current time and Closed >= Current time
    Config key : RUN_CONSULTATION_RESPONDANTS_JOB

### Obligations job
Updates entire Reporting Obligations Table from ROD database.  https://rod.eionet.europa.eu/

    Filters: None
    Config key : RUN_OBLIGATIONS_JOB
    ConfigurationListEntry: ReportingClientsUrl, ReportingInstrumentsUrl, ReportingObligationsUrl

### Last sign in date job
Updates the *LastSingInDate* field with the last time the user signed in based on signInActivity from GraphAPI. The date is related to any sign of the user in the tenant.
**For the moment requires the beta endpoint of the Graph API**

    Filters: SignedIn = 1
    Config key : RUN_LAST_SING_IN_DATE_JOB

## On-demand jobs, to be run manually for specific cases

### User membership job - Helper job  - on demand
Updated user group memberships and tags based on data in User sharepoint list. If UpdatedAllTags is set to true in Configuration list then all tags are checked and corrected. If not, *only tags related to groups that are corrected* will be applied. Should be run once in a while to spot possible inconsistencies

    Filters: SignedIn eq 1
    Config key : RUN_USER_MEMBERSHIPS_JOB
    ConfigurationListEntry: UpdatedAllTags

### Meeting fields job all - Helper job  - on demand
Similar to the meeting fields job, but takes into account **all** meetings from the past. This is a on-demand helper job and only triggered where needed, e.g. when older participants lists are updated manually.
Updates fields *MeetingLink, NoOfParticipants, NoOfRegistered, Countries* based on MeetingJoinId and information from participants list.

    Filters: none (loads all meetings)
    Config key: RUN_MEETING_FIELDS_JOB_ALL


### Remove tags job - Helper job  - on demand
Removes specified tags from user that have not yet finalized the signing in process. For the moment the tags that need to be removed are hardcoded in the job's code.

    Filters: SignedIn = 0 and SignedIn = null
    Config key : RUN_REMOVE_USER_TAGS

### Remove users job - Helper job  - on demand
Removes users that have not finalized the sign in process or users with no activity after a specified date. See also Configuration file.
This job is designed to be run manually because of the confirmation required. To run the job open a terminal in the folder containing the jobs source code, configure the .env file correctly to enable the job and run the following command:
    
    node index.js


    Filters: ((SignedIn = 0 or SignedIn = null) and CreatedDateTime < CurrentTime - configuration.RemoveNonSignedInUserNoOfDays)
        OR (LastSignDate < configuration.UserRemovalLastSignInDateTime)
    Config key : RUN_REMOVE_USERS
    ConfigurationListEntry: RemoveNonSignedInUserNoOfDays
    ConfigurationListEntry: UserRemovalLastSignInDateTime

## Release

See [RELEASE.md](https://github.com/eea/eionet2-azure-jobs/blob/master/RELEASE.md).

## How to contribute

For now the contributions are not open outside the internal EEA project team.

## Copyright and license

The Initial Owner of the Original Code is [European Environment Agency (EEA)](http://eea.europa.eu).
All Rights Reserved.

See [LICENSE.md](https://github.com/eea/eionet2-user-management/blob/master/LICENSE.md) for details.
