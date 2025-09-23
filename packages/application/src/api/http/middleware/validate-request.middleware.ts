import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { badRequest } from '@src/api/http/processors/response';

export function validateRequest(validators: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validators.map(validator => validator.run(req)));

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json(badRequest('Validation failed', errorMessages));
    }

    next();
  };
}
