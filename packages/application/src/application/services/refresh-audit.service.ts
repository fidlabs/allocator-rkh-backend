import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { AuditData, AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { RefreshAuditPublisher } from '../publishers/refresh-audit-publisher';
import { AuditOutcomeResolver } from '../resolvers/audit-outcome-resolver';
import { ApplicationPullRequestFile } from './pull-request.types';

type UpdateAuditResult = {
  auditChange: Partial<AuditData>;
  branchName: string;
  commitSha: string;
  prNumber: number;
  prUrl: string;
};

export interface IRefreshAuditService {
  startAudit(jsonHash: string): Promise<UpdateAuditResult>;
  approveAudit(jsonHash: string, datacapAmount: number): Promise<UpdateAuditResult>;
  rejectAudit(jsonHash: string): Promise<UpdateAuditResult>;
  finishAudit(jsonHash: string): Promise<UpdateAuditResult>;
}

@injectable()
export class RefreshAuditService implements IRefreshAuditService {
  constructor(
    @inject(TYPES.RefreshAuditPublisher)
    private readonly _refreshAuditPublisher: RefreshAuditPublisher,
    @inject(TYPES.AuditOutcomeResolver)
    private readonly _auditOutcomeResolver: AuditOutcomeResolver,
  ) {}

  async startAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.newAudit(jsonHash);
  }

  async approveAudit(jsonHash: string, datacapAmount: number): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(
      jsonHash,
      {
        ended: new Date().toISOString(),
        outcome: AuditOutcome.APPROVED,
        datacapAmount,
      },
      [AuditOutcome.PENDING],
    );
  }

  async rejectAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(
      jsonHash,
      {
        ended: new Date().toISOString(),
        outcome: AuditOutcome.REJECTED,
      },
      [AuditOutcome.PENDING],
    );
  }

  async finishAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(
      jsonHash,
      allocator => {
        const prevAudit = allocator.audits.at(-2);
        const currentAudit = allocator.audits.at(-1);

        return {
          dcAllocated: new Date().toISOString(),
          outcome: this._auditOutcomeResolver.resolve(prevAudit, currentAudit),
        };
      },
      [AuditOutcome.APPROVED],
    );
  }
}
