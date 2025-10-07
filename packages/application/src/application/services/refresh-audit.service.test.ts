import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { RefreshAuditService } from './refresh-audit.service';
import { AuditOutcomeResolver } from '../resolvers/audit-outcome-resolver';

describe('RefreshAuditService', () => {
  let container: Container;
  let service: RefreshAuditService;

  const refreshAuditPublisherMock = {
    newAudit: vi.fn(),
    updateAudit: vi.fn(),
  };

  const jsonHash = 'rec123abc';

  beforeEach(() => {
    container = new Container();
    container.bind(TYPES.RefreshAuditPublisher).toConstantValue(refreshAuditPublisherMock);
    container.bind(TYPES.AuditOutcomeResolver).to(AuditOutcomeResolver).inSingletonScope();
    container.bind<RefreshAuditService>(TYPES.RefreshAuditService).to(RefreshAuditService);
    service = container.get<RefreshAuditService>(TYPES.RefreshAuditService);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
  });

  describe('startAudit', () => {
    it('startAudit calls publisher.newAudit and returns result', async () => {
      const expected = {
        auditChange: {},
        branchName: 'b',
        commitSha: 'c',
        prNumber: 1,
        prUrl: 'u',
      };
      refreshAuditPublisherMock.newAudit.mockResolvedValue(expected);

      const result = await service.startAudit(jsonHash);

      expect(refreshAuditPublisherMock.newAudit).toHaveBeenCalledWith(jsonHash);
      expect(result).toBe(expected);
    });
  });

  describe('approveAudit', () => {
    it('approveAudit sets ended and APPROVED outcome', async () => {
      const datacapAmount = 10;
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

      const result = await service.approveAudit(jsonHash, datacapAmount);

      expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalledWith(
        jsonHash,
        {
          datacapAmount,
          ended: new Date().toISOString(),
          outcome: AuditOutcome.APPROVED,
        },
        [AuditOutcome.PENDING],
      );
      expect(result.auditChange).toEqual(expectedChange);
    });
  });

  describe('rejectAudit', () => {
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

      expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalledWith(
        jsonHash,
        {
          ended: new Date().toISOString(),
          outcome: AuditOutcome.REJECTED,
        },
        [AuditOutcome.PENDING],
      );
      expect(result.auditChange).toEqual(expectedChange);
    });
  });

  describe('finishAudit', () => {
    const fixtureNow = new Date('2024-01-01T00:00:00.000Z');
    const grantedAudit = {
      ended: '2023-01-01T00:00:00.000Z',
      outcome: AuditOutcome.GRANTED,
      datacap_amount: 10,
      dc_allocated: '2024-01-01T00:00:00.000Z',
      started: '2022-01-01T00:00:00.000Z',
    };
    const pendingAudit = {
      started: '2024-01-01T00:00:00.000Z',
      outcome: AuditOutcome.PENDING,
    };
    const approvedAudit = {
      started: '2022-01-01T00:00:00.000Z',
      ended: '2023-01-01T00:00:00.000Z',
      outcome: AuditOutcome.APPROVED,
      datacap_amount: 20,
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixtureNow);
    });

    it('finishAudit sets ended outcome and dcAllocated and newDatacapAmount', async () => {
      const fixtureAllocator = {
        audits: [grantedAudit, pendingAudit],
      };
      refreshAuditPublisherMock.updateAudit.mockImplementation((_, callback) => {
        return {
          auditChange: callback(fixtureAllocator),
          branchName: 'b',
          commitSha: 'c',
          prNumber: 1,
          prUrl: 'u',
        };
      });

      const result = await service.finishAudit(jsonHash, {
        newDatacapAmount: 10,
        dcAllocatedDate: new Date().toISOString(),
      });

      expect(result.auditChange).toEqual({
        ended: fixtureNow.toISOString(),
        dcAllocated: fixtureNow.toISOString(),
        datacapAmount: 10,
        outcome: AuditOutcome.MATCH,
      });

      expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalledWith(
        jsonHash,
        expect.any(Function),
        [AuditOutcome.PENDING, AuditOutcome.APPROVED],
      );
    });

    it('finishAudit sets dcAllocatedDate and outcome and does not change ended date and datacapAmount', async () => {
      const fixtureAllocator = {
        audits: [grantedAudit, approvedAudit],
      };
      refreshAuditPublisherMock.updateAudit.mockImplementation((_, callback) => {
        return {
          auditChange: callback(fixtureAllocator),
          branchName: 'b',
          commitSha: 'c',
          prNumber: 1,
          prUrl: 'u',
        };
      });

      const result = await service.finishAudit(jsonHash, {
        dcAllocatedDate: fixtureNow.toISOString(),
      });

      expect(result.auditChange).toEqual({
        ended: fixtureAllocator.audits[1].ended,
        datacapAmount: fixtureAllocator.audits[1].datacap_amount,
        dcAllocated: fixtureNow.toISOString(),
        outcome: AuditOutcome.DOUBLE,
      });

      expect(refreshAuditPublisherMock.updateAudit).toHaveBeenCalledWith(
        jsonHash,
        expect.any(Function),
        [AuditOutcome.PENDING, AuditOutcome.APPROVED],
      );
    });

    it('finishAudit sets ended and unknown outcome and datacapAmount', async () => {
      const fixtureAllocator = {
        audits: [grantedAudit, pendingAudit],
      };
      refreshAuditPublisherMock.updateAudit.mockImplementation((_, callback) => {
        return {
          auditChange: callback(fixtureAllocator),
          branchName: 'b',
          commitSha: 'c',
          prNumber: 1,
          prUrl: 'u',
        };
      });

      const result = await service.finishAudit(jsonHash, {
        newDatacapAmount: 100,
        dcAllocatedDate: fixtureNow.toISOString(),
      });

      expect(result.auditChange).toEqual({
        ended: fixtureNow.toISOString(),
        datacapAmount: 100,
        dcAllocated: fixtureNow.toISOString(),
        outcome: AuditOutcome.UNKNOWN,
      });
    });
  });
});
