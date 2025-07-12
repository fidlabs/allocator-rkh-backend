export const LOG_MESSAGES = {
  REFRESH_CONTROLLER: {
    FETCHING_ISSUES: '[RefreshController]: Fetching issues from github',
    ISSUES_RETRIEVED: '[RefreshController]: Issues retrieved successfully',
    FAILED_TO_GET_ISSUES: '[RefreshController]: Failed to get issues',
  },

  FETCH_ISSUES_COMMAND: {
    FETCHING_ISSUES: '[FetchIssuesCommand]: Fetching issues from github',
    ISSUES_RETRIEVED: '[FetchIssuesCommand]: Issues retrieved successfully',
    MAPPING_ISSUES: '[FetchIssuesCommand]: Mapping issues',
    ISSUES_MAPPED: '[FetchIssuesCommand]: Issues mapped successfully',
    FAILED_TO_GET_ISSUES: '[FetchIssuesCommand]: Failed to get issues',
    CONNECTING_ALLOCATORS_TO_ISSUES: '[FetchIssuesCommand]: Connecting allocator to issue',
    ALLOCATORS_CONNECTED_TO_ISSUES:
      '[FetchIssuesCommand]: Allocator connected to issue successfully',
    FAILED_TO_CONNECT_ALLOCATORS_TO_ISSUES:
      '[FetchIssuesCommand]: Failed to connect allocator to issue',
  },

  REFRESH_ISSUES_COMMAND: {
    REFRESHING_ISSUES: '[RefreshIssuesCommand]: Refreshing issues from github',
    REFETCHING_FAILED: '[RefreshIssuesCommand]: Failed to refresh issues',
    UPDATING_ISSUES: '[RefreshIssuesCommand]: Updating issues in database',
    ISSUES_UPDATED: '[RefreshIssuesCommand]: Issues updated successfully',
    FAILED_TO_UPDATE_ISSUES: '[RefreshIssuesCommand]: Failed to update issues',
  },

  UPSERT_ISSUE_COMMAND: {
    UPSERTING_ISSUE: '[UpsertIssueCommand]: Upserting issue',
    ISSUE_UPSERTED: '[UpsertIssueCommand]: Issue upserted successfully',
    FAILED_TO_UPSERT_ISSUE: '[UpsertIssueCommand]: Failed to upsert issue',
    CONNECTING_ALLOCATOR_TO_ISSUE: '[UpsertIssueCommand]: Connecting allocator to issue',
    ALLOCATOR_CONNECTED_TO_ISSUE: '[UpsertIssueCommand]: Allocator connected to issue successfully',
    FAILED_TO_CONNECT_ALLOCATOR_TO_ISSUE:
      '[UpsertIssueCommand]: Failed to connect allocator to issue',
  },

  BULK_CREATE_ISSUE_COMMAND: {
    BULK_CREATING_ISSUES: '[BulkCreateIssueCommand]: Bulk creating issues',
    ISSUES_CREATED: '[BulkCreateIssueCommand]: Issues created successfully',
    FAILED_TO_CREATE_ISSUES: '[BulkCreateIssueCommand]: Failed to create issues',
  },

  FETCH_ALLOCATOR_COMMAND: {
    FETCHING_ALLOCATOR: '[FetchAllocatorCommand]: Fetching allocator',
    ALLOCATOR_FILE_RETRIEVED: '[FetchAllocatorCommand]: Allocator retrieved successfully',
    ALLOCATOR_FILE_MAPPING: '[FetchAllocatorCommand]: Mapping allocator file',
    ALLOCATOR_FILE_MAPPED: '[FetchAllocatorCommand]: Allocator file mapped successfully',
    ALLOCATOR_NOT_FOUND: '[FetchAllocatorCommand]: Allocator not found',
    FAILED_TO_GET_ALLOCATOR: '[FetchAllocatorCommand]: Failed to get allocator',
  },

  APPROVE_REFRESH_BY_RKH_COMMAND: {
    APPROVE_REFRESH_BY_RKH: '[ApproveRefreshByRKHCommand]: Approving refresh by RKH',
    REFRESH_APPROVED: '[ApproveRefreshByRKHCommand]: Refresh approved successfully',
    FAILED_TO_APPROVE_REFRESH: '[ApproveRefreshByRKHCommand]: Failed to approve refresh',
  },

  SIGN_REFRESH_BY_RKH_COMMAND: {
    SIGN_REFRESH_BY_RKH: '[SignRefreshByRKHCommand]: Signing refresh by RKH',
    REFRESH_SIGNED: '[SignRefreshByRKHCommand]: Refresh signed successfully',
    FAILED_TO_SIGN_REFRESH: '[SignRefreshByRKHCommand]: Failed to sign refresh',
  },

  APPROVE_REFRESH_BY_MA_COMMAND: {
    APPROVE_REFRESH_BY_MA: '[ApproveRefreshByMaCommand]: Approving refresh by Meta allocator',
    REFRESH_APPROVED: '[ApproveRefreshByMaCommand]: Refresh approved successfully',
    FAILED_TO_APPROVE_REFRESH: '[ApproveRefreshByMaCommand]: Failed to approve refresh',
  },
};
