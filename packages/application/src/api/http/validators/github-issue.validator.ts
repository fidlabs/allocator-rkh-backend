import { body, query } from 'express-validator';
import { VALIDATION_MESSAGES } from '@src/constants/validation-messages';

export const validateIssueUpsert = [
  body('issue')
    .exists()
    .withMessage(VALIDATION_MESSAGES.ISSUE.REQUIRED)
    .bail()
    .isObject()
    .withMessage(VALIDATION_MESSAGES.ISSUE.INVALID_OBJECT),

  body('issue.id')
    .exists()
    .withMessage(VALIDATION_MESSAGES.ISSUE_ID.REQUIRED)
    .bail()
    .isInt({ min: 1 })
    .withMessage(VALIDATION_MESSAGES.ISSUE_ID.INVALID),

  body('issue.body')
    .exists()
    .withMessage(VALIDATION_MESSAGES.ISSUE_BODY.REQUIRED)
    .bail()
    .isString()
    .withMessage(VALIDATION_MESSAGES.ISSUE_BODY.INVALID),

  body('issue.title')
    .exists()
    .withMessage(VALIDATION_MESSAGES.ISSUE_TITLE.REQUIRED)
    .bail()
    .isString()
    .withMessage(VALIDATION_MESSAGES.ISSUE_TITLE.INVALID)
    .bail()
    .contains('[DataCap Refresh]')
    .withMessage(VALIDATION_MESSAGES.ISSUE_TITLE.MISSING_DATACAP_REFRESH),

  body('issue.state')
    .exists()
    .withMessage(VALIDATION_MESSAGES.ISSUE_STATE.REQUIRED)
    .bail()
    .isString()
    .withMessage(VALIDATION_MESSAGES.ISSUE_STATE.INVALID)
    .bail()
    .isIn(['open', 'edited'])
    .withMessage(VALIDATION_MESSAGES.ISSUE_STATE.INVALID_VALUE),
];

export const validateRefreshesQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
];
