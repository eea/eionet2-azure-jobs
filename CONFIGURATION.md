### [1.2.6]
Configuration keys
    - NoOfUsersToProcessMembershipJob - Specifies the number of users that will be processed by the user membership update job. The job will stop after the value is reached.

### [1.2.8]
Configuration keys
    - UpdateAllTags - If set to true all the tags are checked and corrected. If set to false or missing only tags related to group inconsistencies are applied.

### [1.3.4]
Configuration keys
    - UserRemovalLastSignInDateTime - Users with no activity after this date can be removed by the user removal job
    - RemoveNonSignedInUserNoOfDays - Number of days after which users that have not finalized the sign in process can be remove by user removal job

### [1.3.7]
    - Reportnet2DataflowPublicUrl - base URL for dataflow that opens from the list.
    - Reportnet3DataflowUrl - base URL for loading Reportnet3 dataflows (should not include query parameters)
    - ReportnetFlowsListId - id of the sharepoint list the will contain the dataflows
