import { injectable } from 'inversify';

import { AuditData, AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { AuditCycle } from '@src/application/services/pull-request.types';

export interface IAuditMapper {
  fromDomainToAuditData(jsonAuditCycle: AuditCycle): AuditData;

  fromAuditDataToDomain(auditData: Partial<AuditData>): AuditCycle;

  partialFromAuditDataToDomain(auditData: Partial<AuditData>): Partial<AuditCycle>;
}

@injectable()
export class AuditMapper implements IAuditMapper {
  private readonly toDomainMapping: Record<keyof AuditData, keyof AuditCycle> = {
    started: 'started',
    ended: 'ended',
    dcAllocated: 'dc_allocated',
    outcome: 'outcome',
    datacapAmount: 'datacap_amount',
  };

  fromDomainToAuditData(jsonAuditCycle: AuditCycle): AuditData {
    return {
      started: jsonAuditCycle.started,
      ended: jsonAuditCycle.ended,
      dcAllocated: jsonAuditCycle.dc_allocated,
      outcome: jsonAuditCycle.outcome as AuditOutcome,
      datacapAmount: jsonAuditCycle.datacap_amount,
    };
  }

  fromAuditDataToDomain(auditData: AuditData): AuditCycle {
    return {
      started: auditData.started,
      ended: auditData.ended,
      dc_allocated: auditData.dcAllocated,
      outcome: auditData.outcome as AuditOutcome,
      datacap_amount: auditData.datacapAmount as number,
    };
  }

  partialFromAuditDataToDomain(auditData: Partial<AuditData>): Partial<AuditCycle> {
    return Object.fromEntries(
      Object.entries(auditData).map(([key, value]) => [this.toDomainMapping[key], value]),
    );
  }
}
