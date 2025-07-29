import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

const validators = {
  updateKYC: [param('allocatorId').isString(), body('kycData').isObject()],
};

export const validateRequest = (validatorKey: keyof typeof validators) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validators[validatorKey].map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    res.status(400).json({ errors: errors.array() });
  };
};
