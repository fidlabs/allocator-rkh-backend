import {
  controller,
  httpGet,
  httpPost,
  request,
  requestBody,
  requestParam,
  response,
} from 'inversify-express-utils';
import { Request, Response } from 'express';
import { badPermissions, badRequest, ok } from '@src/api/http/processors/response';
import { MetaAllocatorService } from '@src/application/services/meta-allocator.service';
import { TYPES } from '@src/types';
import { inject } from 'inversify';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '@src/constants';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { validateGovernanceReview } from '../validators';
import { validateRequest } from '../middleware/validate-request.middleware';
import { GovernanceReviewDto } from '@src/application/dtos/GovernanceReviewDto';
import { RoleService } from '@src/application/services/role.service';
import { RejectRefreshCommand } from '@src/application/use-cases/refresh-issues/reject-refesh.command';
import {
  SignatureGuard,
  SignatureType,
  WalletType,
} from '@src/patterns/decorators/signature-guard.decorator';

const LOG = LOG_MESSAGES.MA_CONTROLLER;
const RES = RESPONSE_MESSAGES.MA_CONTROLLER;

@controller('/api/v1/ma')
export class MetaAllocatorController {
  constructor(
    @inject(TYPES.MetaAllocatorService) private readonly metaAllocatorService: MetaAllocatorService,
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.RoleService) private readonly roleService: RoleService,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
  ) {}

  @httpGet('')
  async getMetaAllocatorAddresses(@request() req: Request, @response() res: Response) {
    this.logger.info(LOG.FETCHING_MA_ADDRESSES);
    return res.json(ok(RES.MA_ADDRESSES_RETRIEVED, this.metaAllocatorService.getAll()));
  }

  @httpPost('/:githubIssueNumber/reject', validateRequest(validateGovernanceReview))
  @SignatureGuard(SignatureType.MetaAllocatorReject, WalletType.MetaMask)
  async rejectMetaAllocator(
    @requestParam('githubIssueNumber') githubIssueNumber: string,
    @requestBody() rejectMetaAllocatorDto: GovernanceReviewDto,
    @response() res: Response,
  ) {
    this.logger.info(LOG.REJECTING_REFRESH_AS_META_ALLOCATOR);
    const id = parseInt(githubIssueNumber);
    const {
      result,
      details: { reviewerAddress },
    } = rejectMetaAllocatorDto;

    const role = this.roleService.getRole(reviewerAddress);
    if (!['GOVERNANCE_TEAM', 'METADATA_ALLOCATOR'].includes(role as string)) {
      this.logger.error(`Cannot reject refresh: ${role as string} for address ${reviewerAddress} not authorised`)
      return res.status(403).json(badPermissions());
    }

    const refreshResult = await this.commandBus.send(new RejectRefreshCommand(id));
    if (!refreshResult.success) {
      return res.status(400).json(badRequest(refreshResult.error.message));
    }

    return res.json(ok(RES.REJECTED_AS_META_ALLOCATOR, result));
  }
}
