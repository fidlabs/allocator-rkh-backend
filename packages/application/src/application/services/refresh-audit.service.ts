import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';
import { AuditData, AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { RefreshAuditPublisher } from '../publishers/refresh-audit-publisher';
import { AuditOutcomeResolver } from '../resolvers/audit-outcome-resolver';

type UpdateAuditResult = {
  auditChange: Partial<AuditData>;
  branchName: string;
  commitSha: string;
  prNumber: number;
  prUrl: string;
};

export interface IRefreshAuditService {
  startAudit(jsonHash: string): Promise<UpdateAuditResult>;
  approveAudit(jsonHash: string): Promise<UpdateAuditResult>;
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

  async approveAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(jsonHash, {
      ended: new Date().toISOString(),
      outcome: AuditOutcome.APPROVED,
    });
  }

  async rejectAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(jsonHash, {
      ended: new Date().toISOString(),
      outcome: AuditOutcome.REJECTED,
    });
  }

  async finishAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(jsonHash, allocator => {
      const [prevAudit, currentAudit] = allocator.audits.slice(-2);

      return {
        dcAllocated: new Date().toISOString(),
        outcome: this._auditOutcomeResolver.resolve(prevAudit, currentAudit),
      };
    });
  }
}
