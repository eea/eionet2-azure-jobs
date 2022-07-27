# eionet2-teams-data

[![GitHub release](https://img.shields.io/github/v/release/eea/eionet2-teams-data)](https://github.com/eea/eionet2-teams-data/releases)

This Eionet 2.0 application implements the following features:
- Retrieve the meeting participants automatically from a SharePoint list
- Use the participants and the meeting data to create meeting statistics

The app is available to the designated Eionet Admin roles.

## Getting started

The application is build as a JavaScript application that is scheduled to be executed automatically at the designated interval through Azure (like a "cron" job).
When a meeting is processed the applications retrieves the meeting participants using Graph API automatically, prepares the ouptput data and store it in SharePoint. The application exchanges data with the EEA Azure tenant to match the users with their Eionet specific information stored in SharePoint.
The output information is used for various reports, such as NFP dashboard and statistics.

## Release

See [RELEASE.md](https://github.com/eea/eionet2-teams-data/blob/master/RELEASE.md).

## How to contribute

For now the contributions are not open outside the internal EEA project team.

## Copyright and license

The Initial Owner of the Original Code is [European Environment Agency (EEA)](http://eea.europa.eu).
All Rights Reserved.

See [LICENSE.md](https://github.com/eea/eionet2-user-management/blob/master/LICENSE.md) for details.