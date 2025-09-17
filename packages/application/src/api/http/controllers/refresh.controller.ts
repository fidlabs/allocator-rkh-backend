import { ICommandBus, IQueryBus } from '@filecoin-plus/core';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
  request,
  requestBody,
  response,
} from 'inversify-express-utils';

import { badRequest, ok } from '@src/api/http/processors/response';
import { TYPES } from '@src/types';
import { RefreshIssuesCommand } from '@src/application/use-cases/refresh-issues/refresh-issues.command';
import { GetRefreshesQuery } from '@src/application/queries/get-refreshes/get-refreshes.query';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { UpsertIssueCommand } from '@src/application/use-cases/refresh-issues/upsert-issue.command';
import { IssuesWebhookPayload } from '@src/infrastructure/clients/github';
import { validateIssueUpsert, validateRefreshesQuery } from '@src/api/http/validators';
import { RESPONSE_MESSAGES } from '@src/constants';

const RES = RESPONSE_MESSAGES.REFRESH_CONTROLLER;

@controller('/api/v1/refreshes')
export class RefreshController {
  constructor(
    @inject(TYPES.QueryBus) private readonly _queryBus: IQueryBus,
    @inject(TYPES.CommandBus) private readonly _commandBus: ICommandBus,
    @inject(TYPES.IssueMapper) private readonly _issueMapper: IIssueMapper,
  ) {}

  @httpGet('', ...validateRefreshesQuery)
  async getAllRefreshes(@request() req: Request, @response() res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(badRequest(RES.INVALID_QUERY, errors.array()));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await this._queryBus.execute(new GetRefreshesQuery(page, limit, search));

    return res.json(ok(RES.GET_ALL, result));
  }

  @httpPut('/upsert-from-issue', ...validateIssueUpsert)
  async upsertRefresh(
    @requestBody() githubEvent: IssuesWebhookPayload,
    @response() res: Response,
    @request() req: Request,
  ) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        badRequest(
          RES.INVALID_BODY,
          errors.array().map(error => error.msg),
        ),
      );
    }

    const issueDetails = this._issueMapper.fromDomainToIssue(githubEvent.issue);
    const result = await this._commandBus.send(new UpsertIssueCommand(issueDetails));

    if (!result?.success) {
      return res.status(400).json(badRequest(RES.FAILED_TO_UPSERT_ISSUE, [result.error.message]));
    }
    return res.json(ok(RES.UPSERTED_ISSUE));
  }

  @httpPost('/sync/issues')
  async syncIssues(@response() res: Response) {
    const result = await this._commandBus.send(new RefreshIssuesCommand());

    if (!result.success) {
      return res.status(400).json(badRequest(RES.REFRESH_FAILED, result.error));
    }

    return res.json(ok(RES.REFRESH_SUCCESS, result));
  }
}
