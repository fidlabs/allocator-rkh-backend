import { ICommandBus, IQueryBus } from '@filecoin-plus/core';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
  PARAMETER_TYPE,
  params,
  request,
  requestBody,
  requestParam,
  response,
} from 'inversify-express-utils';

import { badPermissions, badRequest, ok } from '@src/api/http/processors/response';
import { TYPES } from '@src/types';
import { RefreshIssuesCommand } from '@src/application/use-cases/refresh-issues/refresh-issues.command';
import { GetRefreshesQuery } from '@src/application/queries/get-refreshes/get-refreshes.query';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { UpsertIssueCommand } from '@src/application/use-cases/refresh-issues/upsert-issue.command';
import { IssuesWebhookPayload } from '@src/infrastructure/clients/github';
import { validateIssueUpsert, validateRefreshesQuery } from '@src/api/http/validators';
import { RESPONSE_MESSAGES } from '@src/constants';
import { validateGovernanceReview } from '../validators';
import { validateRequest } from '../middleware/validate-request.middleware';
import { GovernanceReviewDto } from '@src/application/dtos/GovernanceReviewDto';
import { RoleService } from '@src/application/services/role.service';
import { SignatureType } from '@src/patterns/decorators/signature-guard.decorator';
import { SignatureGuard } from '@src/patterns/decorators/signature-guard.decorator';
import { RejectRefreshCommand } from '@src/application/use-cases/refresh-issues/reject-refesh.command';
import { ApproveRefreshCommand } from '@src/application/use-cases/refresh-issues/approve-refresh.command';
import { GetRefreshesQueryDto } from '@src/application/dtos/GetRefreshesQueryDto';
import { SyncIssueCommand } from '@src/application/use-cases/refresh-issues/sync-issue.command';

const RES = RESPONSE_MESSAGES.REFRESH_CONTROLLER;

@controller('/api/v1/refreshes')
export class RefreshController {
  constructor(
    @inject(TYPES.QueryBus) private readonly _queryBus: IQueryBus,
    @inject(TYPES.CommandBus) private readonly _commandBus: ICommandBus,
    @inject(TYPES.IssueMapper) private readonly _issueMapper: IIssueMapper,
    @inject(TYPES.RoleService) private readonly _roleService: RoleService,
  ) {}

  @httpGet('', validateRequest(validateRefreshesQuery, RES.INVALID_QUERY))
  async getAllRefreshes(
    @params(PARAMETER_TYPE.QUERY) getRefreshesQueryDto: GetRefreshesQueryDto,
    @response() res: Response,
  ) {
    const { page, limit, search, status } = getRefreshesQueryDto;

    const result = await this._queryBus.execute(
      new GetRefreshesQuery(parseInt(page), parseInt(limit), search, status),
    );

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

  @httpPost('/sync/issue/:githubIssueNumber')
  async syncIssue(
    @requestParam('githubIssueNumber') githubIssueNumber: string,
    @response() res: Response,
  ) {
    const result = await this._commandBus.send(new SyncIssueCommand(parseInt(githubIssueNumber)));

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

  @httpPost('/:githubIssueNumber/review', validateRequest(validateGovernanceReview))
  @SignatureGuard(SignatureType.RefreshReview)
  async approveRefresh(
    @requestParam('githubIssueNumber') githubIssueNumber: string,
    @requestBody() approveRefreshDto: GovernanceReviewDto,
    @response() res: Response,
  ) {
    const id = parseInt(githubIssueNumber);
    const address = approveRefreshDto.details.reviewerAddress;
    const role = this._roleService.getRole(address);
    if (role !== 'GOVERNANCE_TEAM') {
      console.log(`Not a governance team member: ${role}`);
      return res.status(403).json(badPermissions());
    }

    const { result } = approveRefreshDto;

    const command =
      result === 'approve'
        ? new ApproveRefreshCommand(id, parseInt(approveRefreshDto.details.finalDataCap))
        : new RejectRefreshCommand(id);

    const refreshResult = await this._commandBus.send(command);
    if (!refreshResult.success) {
      return res
        .status(400)
        .json(badRequest(RES.FAILED_TO_UPSERT_ISSUE, [refreshResult.error.message]));
    }

    return res.json(ok(RES.REFRESH_SUCCESS, result));
  }
}
