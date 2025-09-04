import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  ApproveRefreshByRKHCommand,
  ApproveRefreshByRKHCommandHandler,
} from './approve-refresh-by-rkh.command';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { ApprovedTx } from '@src/infrastructure/clients/lotus';
import { CommandBus } from '@src/infrastructure/command-bus';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid'),
}));

describe('ApproveRefreshByRKHCommand', () => {
  let container: Container;
  let handler: ApproveRefreshByRKHCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };

  const refreshAuditServiceMock = { finishAudit: vi.fn() };
  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixtureApprovedTx: ApprovedTx = {
    cid: faker.string.alphanumeric(46),
    to: '',
    from: '',
    timestamp: 0,
    params: '',
  };
  const fixtureAuditResult = {
    auditChange: {
      started: '2024-01-01T00:00:00.000Z',
      ended: '2024-01-01T00:00:00.000Z',
      dcAllocated: '2024-01-01T00:00:00.000Z',
      outcome: 'MATCH',
    },
    branchName: 'b',
    commitSha: 'c',
    prNumber: 1,
    prUrl: 'u',
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<CommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as CommandBus);
    container
      .bind<RefreshAuditService>(TYPES.RefreshAuditService)
      .toConstantValue(refreshAuditServiceMock as unknown as RefreshAuditService);
    container.bind<ApproveRefreshByRKHCommandHandler>(ApproveRefreshByRKHCommandHandler).toSelf();

    handler = container.get<ApproveRefreshByRKHCommandHandler>(ApproveRefreshByRKHCommandHandler);

    (refreshAuditServiceMock.finishAudit as any).mockResolvedValue(fixtureAuditResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully approve refresh by RKH', async () => {
    const command = new ApproveRefreshByRKHCommand(fixtureIssueDetails, fixtureApprovedTx);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'guid',
      issueDetails: {
        ...fixtureIssueDetails,
        refreshStatus: 'DC_ALLOCATED',
        transactionCid: fixtureApprovedTx.cid,
        currentAudit: fixtureAuditResult.auditChange,
        auditHistory: [fixtureAuditResult],
      },
    }),
      expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should handle error during repository update', async () => {
    const error = new Error('Failed to update repository');
    commandBusMock.send.mockRejectedValue(error);

    const command = new ApproveRefreshByRKHCommand(fixtureIssueDetails, fixtureApprovedTx);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'guid',
      issueDetails: {
        ...fixtureIssueDetails,
        refreshStatus: 'DC_ALLOCATED',
        transactionCid: fixtureApprovedTx.cid,
        currentAudit: fixtureAuditResult.auditChange,
        auditHistory: [fixtureAuditResult],
      },
    }),
      expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
