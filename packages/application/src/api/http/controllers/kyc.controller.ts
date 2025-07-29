import { ICommandBus } from '@filecoin-plus/core';
import { Response, Request } from 'express';
import { inject } from 'inversify';
import { controller, httpPost, request, response } from 'inversify-express-utils';

import { TYPES } from '@src/types';

import { ok } from '../processors/response';
import { SubmitKYCResultCommand } from '@src/application/use-cases/submit-kyc-result/submit-kyc-result.command';
import { PhaseStatus } from '@src/application/commands/common';

@controller('/api/v1/kyc')
export class KycController {
  constructor(@inject(TYPES.CommandBus) private readonly _commandBus: ICommandBus) {}

  @httpPost('/result/:endpointSecret')
  async submitKYCResult(@request() req: Request, @response() res: Response) {
    const { endpointSecret } = req.params;
    const expectedSecret = process.env.KYC_ENDPOINT_SECRET;

    if (!expectedSecret || endpointSecret !== expectedSecret) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const zypheResult = req.body;
    console.log(zypheResult);
    console.log(zypheResult?.data?.kyc?.customData);

    if (!zypheResult?.event || zypheResult.event != 'COMPLETED') {
      return res.status(400).json({ error: 'KYC process not yet complete' });
    }

    if (!zypheResult?.data || !zypheResult.data?.dv || !zypheResult.data?.dv?.status) {
      return res.status(400).json({ error: 'No results in KYC response' });
    }

    if (!zypheResult?.data?.dv?.customData?.applicationId) {
      return res.status(400).json({ error: 'No application ID specified' });
    }

    const result = await this._commandBus.send(
      new SubmitKYCResultCommand(zypheResult.data.dv.customData.applicationId, {
        status:
          zypheResult.data.dv.status === 'PASSED' ? PhaseStatus.Approved : PhaseStatus.Rejected,
        data: zypheResult.data.dv,
      }),
    );
    return res.json(ok('KYC result submitted successfully', {}));
  }
}
