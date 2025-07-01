import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from '@filecoin-plus/core';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { FetchIssuesCommand, FetchIssuesCommandHandler } from './fetch-issues.command';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';

describe('FetchIssuesCommand', () => {
  let container: Container;
  let handler: FetchIssuesCommandHandler;
  const loggerMock = { info: vi.fn() };
  const githubClientMock = { getIssues: vi.fn() };
  const issueMapperMock = { fromDomainListToIssueList: vi.fn() };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IGithubClient>(TYPES.GithubClient)
      .toConstantValue(githubClientMock as unknown as IGithubClient);
    container
      .bind<IIssueMapper>(TYPES.IssueMapper)
      .toConstantValue(issueMapperMock as unknown as IIssueMapper);
    container.bind<FetchIssuesCommandHandler>(FetchIssuesCommandHandler).toSelf();

    handler = container.get<FetchIssuesCommandHandler>(FetchIssuesCommandHandler);

    vi.clearAllMocks();
  });

  it('should successfully fetch and map issues', async () => {
    const owner = 'owner';
    const repo = 'repo';
    const mockIssues = [{ id: 1 }, { id: 2 }];
    const mockMappedIssues = [{ githubIssueId: 1 }, { githubIssueId: 2 }];

    githubClientMock.getIssues.mockResolvedValueOnce(mockIssues);
    issueMapperMock.fromDomainListToIssueList.mockReturnValueOnce(mockMappedIssues);

    const result = await handler.handle(new FetchIssuesCommand(owner, repo));

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockMappedIssues);
    expect(githubClientMock.getIssues).toHaveBeenCalledWith(owner, repo);
    expect(issueMapperMock.fromDomainListToIssueList).toHaveBeenCalledWith(mockIssues);
  });

  it('should handle errors when fetching issues fails', async () => {
    const owner = 'owner';
    const repo = 'repo';
    const error = new Error('Failed to fetch');
    githubClientMock.getIssues.mockRejectedValueOnce(error);

    const result = await handler.handle(new FetchIssuesCommand(owner, repo));

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });
});
