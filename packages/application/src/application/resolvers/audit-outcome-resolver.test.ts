import { describe, it, expect, beforeEach } from 'vitest';
import { AuditOutcomeResolver } from './audit-outcome-resolver';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { Container } from 'inversify';
import { TYPES } from '@src/types';

describe('AuditOutcomeResolver', () => {
  let container: Container;
  let service: AuditOutcomeResolver;

  const createAuditCycle = (dc: number) => ({
    started: '',
    ended: '',
    dc_allocated: '',
    outcome: '',
    datacap_amount: dc,
  });

  beforeEach(() => {
    container = new Container();
    container.bind<AuditOutcomeResolver>(TYPES.AuditOutcomeResolver).to(AuditOutcomeResolver);

    service = container.get<AuditOutcomeResolver>(TYPES.AuditOutcomeResolver);
  });

  it('returns GRANTED when datacap unchanged', () => {
    expect(service.resolve(createAuditCycle(10), createAuditCycle(10))).toBe(AuditOutcome.GRANTED);
  });

  it('returns DOUBLE when current equals previous * 2', () => {
    expect(service.resolve(createAuditCycle(10), createAuditCycle(20))).toBe(AuditOutcome.DOUBLE);
  });

  it('returns THROTTLE when current equals previous / 2', () => {
    expect(service.resolve(createAuditCycle(10), createAuditCycle(5))).toBe(AuditOutcome.THROTTLE);
  });

  it('returns UNKNOWN for all other cases', () => {
    expect(service.resolve(createAuditCycle(0), createAuditCycle(7))).toBe(AuditOutcome.UNKNOWN);
    expect(service.resolve(createAuditCycle(10), createAuditCycle(0))).toBe(AuditOutcome.UNKNOWN);
    expect(service.resolve(createAuditCycle(7), createAuditCycle(8))).toBe(AuditOutcome.UNKNOWN);
    expect(service.resolve(createAuditCycle(8), createAuditCycle(7))).toBe(AuditOutcome.UNKNOWN);
  });
});
