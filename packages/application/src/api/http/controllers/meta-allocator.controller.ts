import { controller, httpGet, request, response } from 'inversify-express-utils';
import { Request, Response } from 'express';
import { ok } from '@src/api/http/processors/response';
import { MetaAllocatorService } from '@src/application/services/meta-allocator.service';
import { TYPES } from '@src/types';
import { inject } from 'inversify';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '@src/constants';
import { Logger } from '@filecoin-plus/core';

const LOG = LOG_MESSAGES.MA_CONTROLLER;
const RES = RESPONSE_MESSAGES.MA_CONTROLLER;

@controller('/api/v1/ma')
export class MetaAllocatorController {
  constructor(
    @inject(TYPES.MetaAllocatorService) private readonly metaAllocatorService: MetaAllocatorService,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {}

  @httpGet('')
  async getMetaAllocatorAddresses(@request() req: Request, @response() res: Response) {
    this.logger.info(LOG.FETCHING_MA_ADDRESSES);
    return res.json(ok(RES.MA_ADDRESSES_RETRIEVED, this.metaAllocatorService.getAll()));
  }
}
