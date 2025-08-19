import { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { inject } from 'inversify';
import { controller, httpGet, request, response } from 'inversify-express-utils';

import { badRequest, ok } from '@src/api/http/processors/response';

import { TYPES } from '@src/types';
import { RoleService } from '@src/application/services/role.service';

@controller('/api/v1/roles')
export class RoleController {
  constructor(@inject(TYPES.RoleService) private readonly roleService: RoleService) {}

  @httpGet('', query('address').isString())
  async getRole(@request() req: Request, @response() res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(badRequest('Invalid query parameters', errors.array()));
    }

    const address = req.query.address as string;

    const role = this.roleService.getRole(address);

    return res.json(ok('Retrieved role successfully', { role }));
  }
}
