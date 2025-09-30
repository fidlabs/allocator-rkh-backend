import { Container } from 'inversify';
import { AuditMapper } from './audit-mapper';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditData, AuditOutcome } from '../repositories/issue-details';

describe('AuditMapper', () => {
  let container: Container;
  let auditMapper: AuditMapper;
  beforeEach(() => {
    container = new Container();
    container.bind<AuditMapper>(AuditMapper).to(AuditMapper);
    auditMapper = container.get<AuditMapper>(AuditMapper);
  });

  it('fromDomainToAuditData', () => {
    const auditCycle = {
      started: '2023-01-01T00:00:00.000Z',
      ended: '2023-01-02T00:00:00.000Z',
      dc_allocated: '2023-01-03T00:00:00.000Z',
      outcome: AuditOutcome.APPROVED,
      datacap_amount: 1,
    };

    expect(auditMapper.fromDomainToAuditData(auditCycle)).toEqual({
      started: auditCycle.started,
      ended: auditCycle.ended,
      dcAllocated: auditCycle.dc_allocated,
      outcome: auditCycle.outcome,
      datacapAmount: auditCycle.datacap_amount,
    });
  });

  it('fromAuditDataToDomain', () => {
    const auditData = {
      started: '2023-01-01T00:00:00.000Z',
      ended: '2023-01-02T00:00:00.000Z',
      dcAllocated: '2023-01-03T00:00:00.000Z',
      outcome: AuditOutcome.APPROVED,
      datacapAmount: 1,
    };

    expect(auditMapper.fromAuditDataToDomain(auditData)).toEqual({
      started: auditData.started,
      ended: auditData.ended,
      dc_allocated: auditData.dcAllocated,
      outcome: auditData.outcome,
      datacap_amount: auditData.datacapAmount,
    });
  });

  it('partialFromAuditDataToDomain', () => {
    const newAuditData: AuditData = {
      ended: '',
      dcAllocated: '',
      datacapAmount: '',
      started: '2023-01-01T00:00:00.000Z',
      outcome: AuditOutcome.PENDING,
    };
    const approvedAuditData: Partial<AuditData> = {
      started: '2023-01-01T00:00:00.000Z',
      outcome: AuditOutcome.APPROVED,
      datacapAmount: 1,
    };
    const rejectedAuditData: Partial<AuditData> = {
      started: '2023-01-01T00:00:00.000Z',
      outcome: AuditOutcome.REJECTED,
    };
    const finishedAuditData: Partial<AuditData> = {
      started: '2023-01-01T00:00:00.000Z',
      outcome: AuditOutcome.GRANTED,
      datacapAmount: 1,
    };

    expect(auditMapper.partialFromAuditDataToDomain(approvedAuditData)).toEqual({
      started: approvedAuditData.started,
      outcome: approvedAuditData.outcome,
      datacap_amount: approvedAuditData.datacapAmount,
    });

    expect(auditMapper.partialFromAuditDataToDomain(newAuditData)).toEqual({
      ended: newAuditData.ended,
      dc_allocated: newAuditData.dcAllocated,
      datacap_amount: newAuditData.datacapAmount,
      started: newAuditData.started,
      outcome: newAuditData.outcome,
    });

    expect(auditMapper.partialFromAuditDataToDomain(finishedAuditData)).toEqual({
      started: finishedAuditData.started,
      outcome: finishedAuditData.outcome,
      datacap_amount: finishedAuditData.datacapAmount,
    });

    expect(auditMapper.partialFromAuditDataToDomain(rejectedAuditData)).toEqual({
      started: rejectedAuditData.started,
      outcome: rejectedAuditData.outcome,
    });

    expect(auditMapper.partialFromAuditDataToDomain({})).toEqual({});
  });
});
