import { IQueryBus } from '@filecoin-plus/core';
import { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  request,
  requestParam,
  response,
} from 'inversify-express-utils';
import { ICommandBus } from '@filecoin-plus/core';
import { verifyLedgerPoP } from './authutils';

import { badPermissions, badRequest, ok } from '@src/api/http/processors/response';
import { TYPES } from '@src/types';
import { GetApplicationsQuery } from '@src/application/queries/get-applications/get-applications.query';
import { ApplicationStatus } from '@src/domain/application/application';
import { SubmitKYCResultCommand } from '@src/application/use-cases/submit-kyc-result/submit-kyc-result.command';
import { SubmitGovernanceReviewResultCommand } from '@src/application/use-cases/submit-governance-review/submit-governance-review.command';
import { PhaseStatus } from '@src/application/commands/common';
import { KYCApprovedData } from '@src/domain/types';
import { RoleService } from '@src/application/services/role.service';
import config from '@src/config';
import { RevokeKycCommand } from '@src/application/use-cases/revoke-kyc/revoke-kyc.command';
import { GovernanceReviewApproved } from '@src/domain/application/application.events';

@controller('/api/v1/applications')
export class ApplicationController {
  constructor(
    @inject(TYPES.QueryBus) private readonly _queryBus: IQueryBus,
    @inject(TYPES.RoleService) private readonly _roleService: RoleService,
    @inject(TYPES.CommandBus) private readonly _commandBus: ICommandBus,
  ) {}

  @httpGet(
    '',
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isArray(),
    query('status.*').optional().isIn(Object.values(ApplicationStatus)),
    query('search').optional().isString(),
  )
  async getAllApplications(@request() req: Request, @response() res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(badRequest('Invalid query parameters', errors.array()));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as ApplicationStatus[]) || [];
    const search = req.query.search as string | undefined;

    const result = await this._queryBus.execute(
      new GetApplicationsQuery(page, limit, status, search),
    );

    return res.json(ok('Retrieved allocators applications', result));
  }

  @httpGet('/:id')
  async getApplication(@requestParam('id') id: string, @response() res: Response) {
    // const query: GetApplicationQuery = new GetApplicationQuery(req.params.id);
    // const result = await this._queryBus.execute(query);
    // return res.json(ok('Retrieved application successfully', result));
    return res.json(ok('Retrieved application ' + id + 'successfully', {}));
  }

  /* Retaining this for now, but we should remove it in the future once everyone is wallet based */
  @httpPost('/:id/secretApproveKYC', query('address').isString(), query('sig').isString())
  async secretApproveKYC(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
  ) {
    console.log(`Approve KYC by secret for application ${id}`);
    const address = req.query.address as string;

    const role = this._roleService.getRole(address);

    // TODO: make sure sig is a signature by address
    const sig = req.query.sig as string;

    if (!config.GOVERNANCE_REVIEW_SECRET || sig != config.GOVERNANCE_REVIEW_SECRET) {
      return res.status(403).json(badPermissions());
    }

    if (role !== 'GOVERNANCE_TEAM') {
      return res.status(403).json(badPermissions());
    }

    const result = await this._commandBus.send(
      new SubmitKYCResultCommand(id, {
        status: PhaseStatus.Approved,
        data: {
          id: id,
          processMessage: req.body?.reason,
        } as KYCApprovedData,
      }),
    );

    return res.json(ok('KYC result submitted successfully', {}));
  }

  @httpPost('/:id/approveKYC')
  async approveKYC(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
  ) {
    console.log(`Approve KYC by signature for application ${id}`);
    console.log(req.body);
    // RBAC first
    // Check address is on the list of Gov Team addresses
    const address = req.body.reviewerAddress;
    const role = this._roleService.getRole(address);
    if (role !== 'GOVERNANCE_TEAM') {
      console.log(`Not a governance team member: ${role}`);
      return res.status(403).json(badPermissions());
    }

    // Work out what signed message we expect
    const expectedPreImage = `KYC Override for ${id}`;

    // Now check it was authorized on the Ledger
    let verified = false;
    try {
      verified = await verifyLedgerPoP(
        req.body.reviewerAddress,
        req.body.reviewerPublicKey,
        req.body.signature,
        expectedPreImage,
      );
    } catch (err) {
      let msg = 'Unknown error in signature validation';
      if (err instanceof Error) {
        msg = err.message;
      }
      return res.status(400).json(badRequest(msg, []));
    }

    if (!verified) {
      return res.status(403).json(badRequest('Signature verification failure.', []));
    }

    const result = await this._commandBus.send(
      new SubmitKYCResultCommand(id, {
        status: PhaseStatus.Approved,
        data: {
          id: id,
          processMessage: req.body?.reason,
        } as KYCApprovedData,
      }),
    );

    return res.json(ok('KYC result submitted successfully', {}));
  }

  /* Retaining this for now, but we should remove it in the future once everyone is wallet based */
  @httpPost('/:id/secretRevokeKYC', query('address').isString(), query('sig').isString())
  async secretRevokeKYC(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
  ) {
    console.log(`RevokeKYC KYC for application ${id}`);
    const address = req.query.address as string;

    const role = this._roleService.getRole(address);

    // TODO: make sure sig is a signature by address
    const sig = req.query.sig as string;

    if (sig != config.KYC_ENDPOINT_SECRET) {
      return res.status(400).json(badPermissions());
    }

    if (role !== 'GOVERNANCE_TEAM') {
      return res.status(400).json(badPermissions());
    }

    const result = await this._commandBus.send(new RevokeKycCommand(id));

    return res.json(ok('Phase changed successfully', {}));
  }

  @httpPost('/:id/revokeKYC')
  async revokeKYC(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
  ) {
    console.log(`Approve KYC by signature for application ${id}`);
    console.log(req.body);
    // RBAC first
    // Check address is on the list of Gov Team addresses
    const address = req.body.reviewerAddress;
    const role = this._roleService.getRole(address);
    if (role !== 'GOVERNANCE_TEAM') {
      console.log(`Not a governance team member: ${role}`);
      return res.status(403).json(badPermissions());
    }

    // Work out what signed message we expect
    const expectedPreImage = `KYC Revoke for ${id}`;

    // Now check it was authorized on the Ledger
    let verified = false;
    try {
      verified = await verifyLedgerPoP(
        req.body.reviewerAddress,
        req.body.reviewerPublicKey,
        req.body.signature,
        expectedPreImage,
      );
    } catch (err) {
      let msg = 'Unknown error in signature validation';
      if (err instanceof Error) {
        msg = err.message;
      }
      return res.status(400).json(badRequest(msg, []));
    }

    if (!verified) {
      return res.status(403).json(badRequest('Signature verification failure.', []));
    }

    const result = await this._commandBus.send(new RevokeKycCommand(id));

    return res.json(ok('Phase changed successfully', {}));
  }

  /* Retaining this for now, but we should remove it in the future once everyone is wallet based */
  @httpPost(
    '/:id/SecretApproveGovernanceReview',
    query('address').isString(),
    query('sig').isString(),
  )
  async secretApproveGovernanceReview(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
  ) {
    console.log(`Approve Governance Review by secret for application ${id}`);
    const address = req.query.address as string;

    const role = this._roleService.getRole(address);

    // TODO: make sure sig is a signature by address
    // Checking the secret is a HIGHLY TEMPORARY solution
    const sig = req.query.sig as string;

    if (!config.GOVERNANCE_REVIEW_SECRET || sig != config.GOVERNANCE_REVIEW_SECRET) {
      return res.status(403).json(badPermissions());
    }

    if (role !== 'GOVERNANCE_TEAM') {
      return res.status(403).json(badPermissions());
    }

    // Check whether it's an approve or reject
    const reviewResult = req.body;

    if (!reviewResult?.result || !reviewResult?.details) {
      return res.status(400).json({ error: 'Bad Request' });
    }

    const result = await this._commandBus.send(
      new SubmitGovernanceReviewResultCommand(id, {
        status: reviewResult?.result === 'approved' ? PhaseStatus.Approved : PhaseStatus.Rejected,
        data: reviewResult?.details,
      }),
    );

    return res.json(ok('Governance Team Review result submitted successfully', {}));
  }

  @httpPost('/:id/approveGovernanceReview')
  async approveGovernanceReview(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
  ) {
    console.log(`Approve Governance Review by signature for application ${id}`);
    console.log(req.body);

    // RBAC first
    // Check address is on the list of Gov Team addresses
    const address = req.body.details?.reviewerAddress;
    const role = this._roleService.getRole(address);
    if (role !== 'GOVERNANCE_TEAM') {
      console.log(`Not a governance team member: ${role}`);
      return res.status(403).json(badPermissions());
    }

    // Work out what signed message we expect
    const expectedPreImage = `Governance Review ${id} ${req.body.result}`;

    // Now check it was authorized on the Ledger
    let verified = false;
    try {
      verified = await verifyLedgerPoP(
        address,
        req.body.details.reviewerPublicKey,
        req.body.signature,
        expectedPreImage,
      );
    } catch (err) {
      let msg = 'Unknown error in signature validation';
      if (err instanceof Error) {
        msg = err.message;
      }
      return res.status(400).json(badRequest(msg, []));
    }

    if (!verified) {
      return res.status(403).json(badRequest('Signature verification failure.', []));
    }

    // Phew! We made it through all the checks
    const result = await this._commandBus.send(
      new SubmitGovernanceReviewResultCommand(id, {
        status: req.body?.result === 'approved' ? PhaseStatus.Approved : PhaseStatus.Rejected,
        data: req.body?.details,
      }),
    );

    return res.json(ok('Governance Team Review result submitted successfully', {}));
  }
}
