import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { ICommandBus } from '@filecoin-plus/core/src/interfaces/ICommandBus';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { GithubConfig } from '@src/domain/types';
import { Container } from 'inversify';
import { SyncIssueCommand, SyncIssueCommandCommandHandler } from './sync-issue.command';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { GithubIssueFactory } from '@src/testing/mocks/factories';
import { UpsertIssueCommand } from './upsert-issue.command';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid'),
}));

describe('SyncIssueCommand', () => {
  let container: Container;
  let handler: SyncIssueCommandCommandHandler;

  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const githubClientMock = { getIssue: vi.fn() };
  const allocatorGovernanceConfigMock = { owner: 'owner', repo: 'repo' };
  const issueMapperMock = { fromDomainToIssue: vi.fn() };

  const fixtureIssueDetails = GithubIssueFactory.createOpened().issue;

  beforeEach(() => {
    container = new Container();
    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<IGithubClient>(TYPES.GithubClient)
      .toConstantValue(githubClientMock as unknown as IGithubClient);
    container
      .bind<GithubConfig>(TYPES.AllocatorGovernanceConfig)
      .toConstantValue(allocatorGovernanceConfigMock as unknown as GithubConfig);
    container.bind<SyncIssueCommandCommandHandler>(SyncIssueCommandCommandHandler).toSelf();
    container
      .bind<IIssueMapper>(TYPES.IssueMapper)
      .toConstantValue(issueMapperMock as unknown as IIssueMapper);
    handler = container.get<SyncIssueCommandCommandHandler>(SyncIssueCommandCommandHandler);

    vi.clearAllMocks();

    commandBusMock.send.mockResolvedValue({
      data: fixtureIssueDetails,
      success: true,
    });

    githubClientMock.getIssue.mockResolvedValue(fixtureIssueDetails);
    issueMapperMock.fromDomainToIssue.mockReturnValue('mappedIssue');
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should successfully sync issue', async () => {
    const command = new SyncIssueCommand(1);
    const result = await handler.handle(command);

    expect(githubClientMock.getIssue).toHaveBeenCalledWith(
      allocatorGovernanceConfigMock.owner,
      allocatorGovernanceConfigMock.repo,
      1,
    );
    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(UpsertIssueCommand));
    expect(commandBusMock.send).toHaveBeenCalledWith({
      githubIssue: 'mappedIssue',
      guid: 'guid',
    });
    expect(result).toStrictEqual({ success: true });
  });

  it('should handle error when fetching issue fails', async () => {
    const error = new Error('Failed to fetch');
    githubClientMock.getIssue.mockRejectedValue(error);

    const command = new SyncIssueCommand(1);
    const result = await handler.handle(command);
    expect(result).toStrictEqual({ success: false, error });
    expect(githubClientMock.getIssue).toHaveBeenCalledWith(
      allocatorGovernanceConfigMock.owner,
      allocatorGovernanceConfigMock.repo,
      1,
    );
    expect(commandBusMock.send).not.toHaveBeenCalled();
  });

  it('should handle error when upserting issue fails', async () => {
    const error = new Error('Failed to upsert');
    commandBusMock.send.mockResolvedValue({ error, success: false });

    const command = new SyncIssueCommand(1);
    const result = await handler.handle(command);
    expect(result).toStrictEqual({ success: false, error });
    expect(githubClientMock.getIssue).toHaveBeenCalledWith(
      allocatorGovernanceConfigMock.owner,
      allocatorGovernanceConfigMock.repo,
      1,
    );
    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(UpsertIssueCommand));
    expect(loggerMock.error).toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(
      '[SyncIssueCommand]: Failed to sync issue',
      error,
    );
  });
});
