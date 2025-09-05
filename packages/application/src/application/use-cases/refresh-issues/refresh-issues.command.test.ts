import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { RefreshIssuesCommand, RefreshIssuesCommandHandler } from './refresh-issues.command';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { FetchIssuesCommand } from '@src/application/use-cases/refresh-issues/fetch-issues.command';
import { BulkCreateIssueCommand } from '@src/application/use-cases/refresh-issues/bulk-create-issue.command';
import { GithubConfig } from '@src/domain/types';

describe('RefreshIssuesCommand', () => {
  let container: Container;
  let handler: RefreshIssuesCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const allocatorGovernanceConfigMock = { owner: 'owner', repo: 'repo' };
  const fixtureIssues = [
    DatabaseRefreshFactory.create(),
    DatabaseRefreshFactory.create(),
    DatabaseRefreshFactory.create(),
  ];

  beforeEach(() => {
    container = new Container();
    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<GithubConfig>(TYPES.AllocatorGovernanceConfig)
      .toConstantValue(allocatorGovernanceConfigMock as unknown as GithubConfig);
    container.bind<RefreshIssuesCommandHandler>(RefreshIssuesCommandHandler).toSelf();

    handler = container.get(RefreshIssuesCommandHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should refresh issues successfully', async () => {
    commandBusMock.send
      .mockResolvedValueOnce({
        data: fixtureIssues,
        success: true,
      })
      .mockResolvedValueOnce({
        data: 'bulkCreateResults',
        success: true,
      });

    const result = await handler.handle(new RefreshIssuesCommand());

    expect(commandBusMock.send).toHaveBeenNthCalledWith(1, expect.any(FetchIssuesCommand));
    expect(commandBusMock.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        guid: expect.any(String),
        owner: expect.any(String),
        repo: expect.any(String),
      }),
    );
    expect(commandBusMock.send).toHaveBeenNthCalledWith(2, expect.any(BulkCreateIssueCommand));
    expect(commandBusMock.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        guid: expect.any(String),
        githubIssues: fixtureIssues,
      }),
    );
    expect(commandBusMock.send).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
      data: 'bulkCreateResults',
    });
  });

  it('should handle fetch errors and return failure response', async () => {
    const error = new Error('Fetch error');
    commandBusMock.send.mockResolvedValueOnce({
      error,
      success: false,
    });

    const result = await handler.handle(new RefreshIssuesCommand());

    expect(result).toStrictEqual({
      success: false,
      error,
    });
    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(FetchIssuesCommand));
    expect(commandBusMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        guid: expect.any(String),
        owner: expect.any(String),
        repo: expect.any(String),
      }),
    );
    expect(commandBusMock.send).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).toHaveBeenCalled();
  });

  it('should handle bulk ipsert error and return failure response', async () => {
    const error = new Error('Fetch error');

    commandBusMock.send
      .mockResolvedValueOnce({
        data: fixtureIssues,
        success: true,
      })
      .mockResolvedValueOnce({
        error,
        success: false,
      });

    const result = await handler.handle(new RefreshIssuesCommand());

    expect(commandBusMock.send).toHaveBeenNthCalledWith(1, expect.any(FetchIssuesCommand));
    expect(commandBusMock.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        guid: expect.any(String),
        owner: expect.any(String),
        repo: expect.any(String),
      }),
    );
    expect(commandBusMock.send).toHaveBeenNthCalledWith(2, expect.any(BulkCreateIssueCommand));
    expect(commandBusMock.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        guid: expect.any(String),
        githubIssues: fixtureIssues,
      }),
    );
    expect(commandBusMock.send).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
