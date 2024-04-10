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
