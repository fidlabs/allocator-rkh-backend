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
  approveAudit(jsonHash: string, newDatacapAmount: number): Promise<UpdateAuditResult>;
  rejectAudit(jsonHash: string): Promise<UpdateAuditResult>;
  finishAudit(
    jsonHash: string,
    {
      newDatacapAmount,
      dcAllocatedDate,
    }: {
      newDatacapAmount: number;
      dcAllocatedDate: string;
    },
  ): Promise<UpdateAuditResult>;
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

  async approveAudit(jsonHash: string, newDatacapAmount: number): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(
      jsonHash,
      {
        ended: new Date().toISOString(),
        outcome: AuditOutcome.APPROVED,
        datacapAmount: newDatacapAmount,
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

  async finishAudit(
    jsonHash: string,
    {
      newDatacapAmount,
      dcAllocatedDate,
    }: {
      newDatacapAmount?: number | '';
      dcAllocatedDate: string;
    },
  ): Promise<UpdateAuditResult> {
    return this._refreshAuditPublisher.updateAudit(
      jsonHash,
      allocator => {
        const now = new Date().toISOString();
        const prevAudit = allocator?.audits?.at(-2);
        const currentAudit = allocator?.audits?.at(-1);
        const endedDate = currentAudit?.ended || dcAllocatedDate || now;
        const dcAllocated = dcAllocatedDate || now;
        const datacapAmount = newDatacapAmount || currentAudit?.datacap_amount || 0;

        return {
          dcAllocated: dcAllocated,
          ended: endedDate,
          outcome: this._auditOutcomeResolver.resolve(prevAudit?.datacap_amount, datacapAmount),
          datacapAmount,
        };
      },
      [AuditOutcome.PENDING, AuditOutcome.APPROVED],
    );
  }
}
