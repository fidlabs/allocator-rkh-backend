import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import {
  SaveIssueWithNewAuditCommand,
  SaveIssueWithNewAuditCommandHandler,
} from './save-issue-with-new-audit.command';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { SaveIssueCommand } from './save-issue.command';

describe('SaveIssueWithNewAuditCommand', () => {
  let container: Container;
  let handler: SaveIssueWithNewAuditCommandHandler;

  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const refreshAuditServiceMock = { startAudit: vi.fn() };

  const issue = DatabaseRefreshFactory.create();
  const auditResult = {
    auditChange: {
      started: '2024-01-01T00:00:00.000Z',
      ended: '',
      dcAllocated: '',
      outcome: 'PENDING',
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
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<RefreshAuditService>(TYPES.RefreshAuditService)
      .toConstantValue(refreshAuditServiceMock as unknown as RefreshAuditService);
    container
      .bind<SaveIssueWithNewAuditCommandHandler>(SaveIssueWithNewAuditCommandHandler)
      .toSelf();

    handler = container.get<SaveIssueWithNewAuditCommandHandler>(
      SaveIssueWithNewAuditCommandHandler,
    );

    (refreshAuditServiceMock.startAudit as any).mockResolvedValue(auditResult);
    (commandBusMock.send as any).mockResolvedValue({ success: true });
    vi.clearAllMocks();
  });

  it('starts audit, merges changes into issue, and saves it', async () => {
    const result = await handler.handle(new SaveIssueWithNewAuditCommand(issue));

    expect(refreshAuditServiceMock.startAudit).toHaveBeenCalledWith(issue.jsonNumber);
    expect(commandBusMock.send).toHaveBeenCalled();

    const sentCommand = (commandBusMock.send as any).mock.calls[0][0] as SaveIssueCommand;

    expect(sentCommand).toBeInstanceOf(SaveIssueCommand);
    expect(sentCommand.issueDetails.currentAudit?.started).toBe(auditResult.auditChange.started);
    expect(result).toStrictEqual({ success: true });
  });

  it('returns failure when startAudit throws', async () => {
    const error = new Error('audit failed');
    (refreshAuditServiceMock.startAudit as any).mockRejectedValueOnce(error);

    const result = await handler.handle(new SaveIssueWithNewAuditCommand(issue));
    expect(result).toStrictEqual({ success: false, error });
  });
});
