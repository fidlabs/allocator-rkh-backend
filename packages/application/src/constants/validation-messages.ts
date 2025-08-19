export const VALIDATION_MESSAGES = {
  ISSUE: {
    REQUIRED: 'Issue is required',
    EMPTY: 'Issue cannot be empty',
    INVALID_OBJECT: 'Issue must be an object',
  },
  ISSUE_ID: {
    REQUIRED: 'Issue ID is required',
    INVALID: 'Issue ID must be a positive integer',
  },
  ISSUE_BODY: {
    REQUIRED: 'Issue body is required',
    INVALID: 'Issue body must be a string',
  },
  ISSUE_TITLE: {
    REQUIRED: 'Issue title is required',
    INVALID: 'Issue title must be a string',
    MISSING_DATACAP_REFRESH: 'Issue title must contain [DataCap Refresh]',
  },
  ISSUE_STATE: {
    REQUIRED: 'Issue state is required',
    INVALID: 'Issue state must be a string',
    INVALID_VALUE: 'Issue state must be either open or edited',
  },
};
