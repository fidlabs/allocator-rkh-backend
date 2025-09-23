import { VALIDATION_MESSAGES } from '@src/constants/validation-messages';
import { body, param } from 'express-validator';

export const validateGovernanceReview = [
  param('githubIssueNumber')
    .isInt({ min: 1, max: Number.MAX_SAFE_INTEGER })
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_GITHUB_ISSUE_NUMBER.INVALID)
    .bail(),

  body('result')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_RESULT.REQUIRED)
    .bail()
    .isIn(['approve', 'reject'])
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_RESULT.INVALID)
    .bail(),

  body('details')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS.REQUIRED)
    .bail()
    .isObject()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS.INVALID),

  body('details.reviewerAddress')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_REVIEWER_ADDRESS.REQUIRED)
    .bail()
    .isString()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_REVIEWER_ADDRESS.INVALID)
    .bail(),

  body('details.reviewerPublicKey')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_REVIEWER_PUBLIC_KEY.REQUIRED)
    .bail()
    .isString()
    .bail()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_REVIEWER_PUBLIC_KEY.INVALID)
    .bail(),

  body('details.finalDataCap')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_FINAL_DATACAP.REQUIRED)
    .bail()
    .isNumeric()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_FINAL_DATACAP.INVALID)
    .bail(),

  body('details.allocatorType')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_ALLOCATOR_TYPE.REQUIRED)
    .bail()
    .isString()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_ALLOCATOR_TYPE.INVALID)
    .bail(),

  body('signature')
    .exists()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_SIGNATURE.REQUIRED)
    .bail()
    .isString()
    .withMessage(VALIDATION_MESSAGES.GOVERNANCE_REVIEW_DETAILS_SIGNATURE.INVALID)
    .bail(),
];
