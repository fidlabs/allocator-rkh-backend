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
    return this._refreshAuditPublisher.updateAudit(jsonHash, allocator => {
      this.ensureCorrectCurrentJsonAuditStatus(allocator, [AuditOutcome.PENDING]);

      return {
        ended: new Date().toISOString(),
        outcome: AuditOutcome.APPROVED,
        datacapAmount,
      };
    });
  }

  async rejectAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(jsonHash, allocator => {
      this.ensureCorrectCurrentJsonAuditStatus(allocator, [AuditOutcome.PENDING]);

      return {
        ended: new Date().toISOString(),
        outcome: AuditOutcome.REJECTED,
      };
    });
  }

  async finishAudit(jsonHash: string): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(jsonHash, allocator => {
      this.ensureCorrectCurrentJsonAuditStatus(allocator, [AuditOutcome.APPROVED]);
      const prevAudit = allocator.audits.at(-2);
      const currentAudit = allocator.audits.at(-1);

      return {
        dcAllocated: new Date().toISOString(),
        outcome: this._auditOutcomeResolver.resolve(prevAudit, currentAudit),
      };
    });
  }

  async ensureCorrectCurrentJsonAuditStatus(
    allocator: ApplicationPullRequestFile,
    status: AuditOutcome[],
  ): Promise<void> {
    const lastAudit = allocator?.audits?.at(-1);
    if (!lastAudit)
      throw new Error('Allocator must have at least one audit from completed application');
    if (!status.includes(lastAudit.outcome as AuditOutcome))
      throw new Error('Cannot update audit because it is not in the correct status');
  }
}
