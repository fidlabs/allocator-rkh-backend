import { Container } from 'inversify';
import { ApproveRefreshCommand, ApproveRefreshCommandHandler } from './approve-refresh.command';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { ICommandBus } from '@filecoin-plus/core';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';
import { SaveIssueCommand } from './save-issue.command';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('nanoid-id'),
}));

describe('ApproveRefreshCommandHandler', () => {
  let container: Container;
  let handler: ApproveRefreshCommandHandler;

  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const refreshAuditServiceMock = { approveAudit: vi.fn() };
  const issueDetailsRepositoryMock = { findPendingBy: vi.fn() };

  const fixtureJsonNumber = 'rec512s579f';
  const fixtureIssueDetails = DatabaseRefreshFactory.create({
    refreshStatus: RefreshStatus.PENDING,
    jsonNumber: fixtureJsonNumber,
  });
  const fixtureApprovedAuditResult = {
    auditChange: {
      ended: '2024-01-01T00:00:00.000Z',
      outcome: 'APPROVED',
      datacapAmount: 100,
    },
  };

  beforeEach(() => {
    container = new Container();
    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<RefreshAuditService>(TYPES.RefreshAuditService)
      .toConstantValue(refreshAuditServiceMock as unknown as RefreshAuditService);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(issueDetailsRepositoryMock as unknown as IIssueDetailsRepository);
    container.bind<ApproveRefreshCommandHandler>(ApproveRefreshCommandHandler).toSelf();
    handler = container.get(ApproveRefreshCommandHandler);

    issueDetailsRepositoryMock.findPendingBy.mockResolvedValue(fixtureIssueDetails);
    refreshAuditServiceMock.approveAudit.mockResolvedValue(fixtureApprovedAuditResult);
    commandBusMock.send.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should approve a refresh', async () => {
    const command = new ApproveRefreshCommand(1, 100);
    const result = await handler.handle(command);

    expect(issueDetailsRepositoryMock.findPendingBy).toHaveBeenCalledWith({
      githubIssueNumber: 1,
    });

    expect(refreshAuditServiceMock.approveAudit).toHaveBeenCalledWith(fixtureJsonNumber, 100);

    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(SaveIssueCommand));
    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'nanoid-id',
      issueDetails: {
        ...fixtureIssueDetails,
        refreshStatus: RefreshStatus.APPROVED,
        dataCap: 100,
        auditHistory: [fixtureApprovedAuditResult],
      },
    });

    expect(result).toStrictEqual({
      success: true,
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
  });
});
