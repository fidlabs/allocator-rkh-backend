import { Event } from '@filecoin-plus/core';
import { AuditData } from '@src/infrastructure/repositories/issue-details';

export interface AuditChanges {
  started?: string;
  ended?: string;
  dc_allocated?: string;
  outcome?: string;
  datacap_amount?: number;
}

export interface AllocatorAuditUpdatedPayload {
  commitSha: string;
  jsonHash: string;
  prNumber: number;
  prUrl: string;
  auditChange: Partial<AuditData>;
}

export class AllocatorAuditUpdated extends Event {
  eventName = AllocatorAuditUpdated.name;
  aggregateName = 'allocator-audits';

  public readonly timestamp: Date;

  constructor(public payload: AllocatorAuditUpdatedPayload) {
    super(payload.jsonHash);
    this.payload = payload;
    this.timestamp = new Date();
  }
}
