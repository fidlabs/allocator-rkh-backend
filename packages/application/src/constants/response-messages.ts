export const RESPONSE_MESSAGES = {
  REFRESH_CONTROLLER: {
    GET_ALL: 'Retrieved refreshes',
    INVALID_QUERY: 'Invalid query parameters',
    INVALID_BODY: 'Invalid body',
    FAILED_TO_UPSERT_ISSUE: 'Failed to upsert issue',
    UPSERTED_ISSUE: 'Issue upserted successfully',
    REFRESH_SUCCESS: 'Refresh successful',
    REFRESH_FAILED: 'Refresh failed',
  },
  FETCH_ALLOCATOR_COMMAND: {
    ALLOCATOR_NOT_FOUND: 'The Allocator could not be found for the given JSON number or hash',
    DEFAULT_ERROR: 'Failed to fetch JSON number',
  },
  UPSERT_ISSUE_COMMAND: {
    JSON_HASH_IS_NOT_FOUND_OR_INCORRECT:
      'The JSON number or hash does not exist in the issue template, or it has been added incorrectly.',
  },
  MA_CONTROLLER: {
    MA_ADDRESSES_RETRIEVED: 'MetaAllocator addresses retrieved successfully',
  },
};
