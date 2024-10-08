import { IQueryBus } from '@filecoin-plus/core'
import { Request, Response } from 'express'
import { query, validationResult } from 'express-validator'
import { inject } from 'inversify'
import { controller, httpGet, request, requestParam, response } from 'inversify-express-utils'

import { badRequest, ok } from '@src/api/http/processors/response'
import { TYPES } from '@src/types'
import { GetApplicationsQuery } from '@src/application/queries/get-applications/get-applications.query'
import { ApplicationStatus } from '@src/domain/application/application'

@controller('/api/v1/applications')
export class ApplicationController {
  constructor(@inject(TYPES.QueryBus) private readonly _queryBus: IQueryBus) {}

  @httpGet(
    '',
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isArray(),
    query('status.*').optional().isIn(Object.values(ApplicationStatus)),
    query('search').optional().isString(),
  )
  async getAllApplications(@request() req: Request, @response() res: Response) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(badRequest('Invalid query parameters', errors.array()))
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const status = (req.query.status as ApplicationStatus[]) || []
    const search = req.query.search as string | undefined

    const result = await this._queryBus.execute(new GetApplicationsQuery(page, limit, status, search))

    return res.json(ok('Retrieved allocators applications', result))
  }

  @httpGet('/:id')
  async getApplication(@requestParam('id') id: string, @response() res: Response) {
    // const query: GetApplicationQuery = new GetApplicationQuery(req.params.id);
    // const result = await this._queryBus.execute(query);
    // return res.json(ok('Retrieved application successfully', result));
    return res.json(ok('Retrieved application ' + id + 'successfully', {}))
  }
}
