import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { FetchIssuesCommand, FetchIssuesCommandHandler } from './fetch-issues.command';
import { Logger } from '@filecoin-plus/core';
import { GithubClient } from '@src/infrastructure/clients/github';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { GithubIssueFactory } from '@mocks/factories';

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
      .bind<GithubClient>(TYPES.GithubClient)
      .toConstantValue(githubClientMock as unknown as GithubClient);
    container
      .bind<IIssueMapper>(TYPES.IssueMapper)
      .toConstantValue(issueMapperMock as unknown as IIssueMapper);
    container.bind(FetchIssuesCommandHandler).toSelf();

    handler = container.get(FetchIssuesCommandHandler);
  });

  it('should fetch and map issues successfully', async () => {
    const mockIssues = [GithubIssueFactory.createOpened().issue];
    const mappedIssues = [{ id: 1, title: 'Test Issue' }];

    githubClientMock.getIssues.mockResolvedValue(mockIssues);
    issueMapperMock.fromDomainListToIssueList.mockReturnValue(mappedIssues);

    const result = await handler.handle(new FetchIssuesCommand('owner', 'repo'));

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mappedIssues);
    expect(githubClientMock.getIssues).toHaveBeenCalledWith('owner', 'repo');
    expect(issueMapperMock.fromDomainListToIssueList).toHaveBeenCalledWith(mockIssues);
  });

  it('should handle errors and return failure response', async () => {
    const error = new Error('Test error');
    githubClientMock.getIssues.mockRejectedValue(error);

    const result = await handler.handle(new FetchIssuesCommand('owner', 'repo'));

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(loggerMock.info).toHaveBeenCalled();
  });
});
