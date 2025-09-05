import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { RefreshAuditService } from './refresh-audit.service';

describe('RefreshAuditService', () => {
  let container: Container;
  let service: RefreshAuditService;

  const refreshAuditPublisherMock = {
    newAudit: vi.fn(),
    updateAudit: vi.fn(),
  };

  const auditOutcomeResolverMock = {
    resolve: vi.fn(),
  };

  const jsonHash = 'rec123abc';

  beforeEach(() => {
    container = new Container();
    container.bind(TYPES.RefreshAuditPublisher).toConstantValue(refreshAuditPublisherMock);
    container.bind(TYPES.AuditOutcomeResolver).toConstantValue(auditOutcomeResolverMock);
    container.bind<RefreshAuditService>(TYPES.RefreshAuditService).to(RefreshAuditService);
    service = container.get<RefreshAuditService>(TYPES.RefreshAuditService);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
  });

  it('startAudit calls publisher.newAudit and returns result', async () => {
    const expected = { auditChange: {}, branchName: 'b', commitSha: 'c', prNumber: 1, prUrl: 'u' };
    refreshAuditPublisherMock.newAudit.mockResolvedValue(expected);

    const result = await service.startAudit(jsonHash);

    expect(refreshAuditPublisherMock.newAudit).toHaveBeenCalledWith(jsonHash);
    expect(result).toBe(expected);
  });

  it('approveAudit sets ended and APPROVED outcome', async () => {
    const expectedChange = {
      ended: new Date().toISOString(),
      outcome: AuditOutcome.APPROVED,
    };
    refreshAuditPublisherMock.updateAudit.mockResolvedValue({
      auditChange: expectedChange,
      branchName: 'b',
      commitSha: 'c',
      prNumber: 1,
      prUrl: 'u',
    });

    const result = await service.approveAudit(jsonHash);

    expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalledWith(jsonHash, expectedChange);
    expect(result.auditChange).toEqual(expectedChange);
  });

  it('rejectAudit sets ended and REJECTED outcome', async () => {
    const expectedChange = {
      ended: new Date().toISOString(),
      outcome: AuditOutcome.REJECTED,
    };
    refreshAuditPublisherMock.updateAudit.mockResolvedValue({
      auditChange: expectedChange,
      branchName: 'b',
      commitSha: 'c',
      prNumber: 1,
      prUrl: 'u',
    });

    const result = await service.rejectAudit(jsonHash);

    expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalledWith(jsonHash, expectedChange);
    expect(result.auditChange).toEqual(expectedChange);
  });

  it('finishAudit computes outcome via resolver and sets dcAllocated', async () => {
    const expectedOutcome = AuditOutcome.MATCH;
    auditOutcomeResolverMock.resolve.mockReturnValue(expectedOutcome);

    const allocatorMock = { audits: [{}, {}] } as any;

    refreshAuditPublisherMock.updateAudit.mockImplementation(
      async (_hash: string, updater: any) => {
        const change = updater(allocatorMock);
        return {
          auditChange: change,
          branchName: 'b',
          commitSha: 'c',
          prNumber: 1,
          prUrl: 'u',
        };
      },
    );

    const result = await service.finishAudit(jsonHash);

    expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalled();
    expect(result.auditChange.outcome).toBe(expectedOutcome);
  });
});
