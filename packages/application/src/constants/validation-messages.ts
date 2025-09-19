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
  GOVERNANCE_REVIEW: {
    REQUIRED: 'Governance review is required',
    INVALID: 'Governance review must be an object',
  },
  GOVERNANCE_REVIEW_RESULT: {
    REQUIRED: 'Governance review result is required',
    INVALID: 'Governance review result must be either approve or reject',
  },
  GOVERNANCE_REVIEW_DETAILS: {
    REQUIRED: 'Governance review details is required',
    INVALID: 'Governance review details must be an object',
  },
  GOVERNANCE_REVIEW_DETAILS_REVIEWER_ADDRESS: {
    REQUIRED: 'Governance review details reviewer address is required',
    INVALID: 'Governance review details reviewer address must be a string',
  },
  GOVERNANCE_REVIEW_DETAILS_REVIEWER_PUBLIC_KEY: {
    REQUIRED: 'Governance review details reviewer public key is required',
    INVALID: 'Governance review details reviewer public key must be a string',
  },
  GOVERNANCE_REVIEW_DETAILS_SIGNATURE: {
    REQUIRED: 'Governance review details signature is required',
    INVALID: 'Governance review details signature must be a string',
  },
  GOVERNANCE_REVIEW_DETAILS_FINAL_DATACAP: {
    REQUIRED: 'Governance review details final data cap is required',
    INVALID: 'Governance review details final data cap must be a number',
  },
  GOVERNANCE_REVIEW_DETAILS_ALLOCATOR_TYPE: {
    REQUIRED: 'Governance review details allocator type is required',
    INVALID: 'Governance review details allocator type must be a string',
  },
  GOVERNANCE_REVIEW_DETAILS_TRANSACTION: {
    REQUIRED: 'Governance review details transaction is required',
    INVALID: 'Governance review details transaction must be a string',
  },
  GOVERNANCE_REVIEW_GITHUB_ISSUE_NUMBER: {
    REQUIRED: 'Governance review github issue number is required',
    INVALID: 'Governance review github issue number must be a positive integer',
  },
};
