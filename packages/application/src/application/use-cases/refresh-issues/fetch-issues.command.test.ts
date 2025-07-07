import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { FetchIssuesCommand, FetchIssuesCommandHandler } from './fetch-issues.command';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { DatabaseRefreshFactory, GithubIssueFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';

describe('FetchIssuesCommand', () => {
  let container: Container;
  let handler: FetchIssuesCommandHandler;
  const loggerMock = { info: vi.fn() };
  const githubClientMock = { getIssues: vi.fn() };
  const issueMapperMock = { fromDomainListToIssueList: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const fixtureIssues = [
    GithubIssueFactory.createOpened().issue,
    GithubIssueFactory.createOpened().issue,
    GithubIssueFactory.createOpened().issue,
  ];
  const fixtureMappedIssues = [
    DatabaseRefreshFactory.create(),
    DatabaseRefreshFactory.create(),
    DatabaseRefreshFactory.create(),
  ];

  const owner = 'owner';
  const repo = 'repo';
  const fixtureMsigAddress = `f2${faker.string.alphanumeric(38)}`;

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IGithubClient>(TYPES.GithubClient)
      .toConstantValue(githubClientMock as unknown as IGithubClient);
    container
      .bind<IIssueMapper>(TYPES.IssueMapper)
      .toConstantValue(issueMapperMock as unknown as IIssueMapper);
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container.bind<FetchIssuesCommandHandler>(FetchIssuesCommandHandler).toSelf();

    handler = container.get<FetchIssuesCommandHandler>(FetchIssuesCommandHandler);

    commandBusMock.send.mockResolvedValue({
      data: { pathway_addresses: { msig: fixtureMsigAddress } },
      success: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully fetch and map issues', async () => {
    githubClientMock.getIssues.mockResolvedValueOnce(fixtureIssues);
    issueMapperMock.fromDomainListToIssueList.mockReturnValueOnce(fixtureMappedIssues);

    const result = await handler.handle(new FetchIssuesCommand(owner, repo));

    expect(result).toStrictEqual({
      success: true,
      data: fixtureMappedIssues.map(issue => ({ ...issue, msigAddress: fixtureMsigAddress })),
    });
    expect(githubClientMock.getIssues).toHaveBeenCalledWith(owner, repo);
    expect(issueMapperMock.fromDomainListToIssueList).toHaveBeenCalledWith(fixtureIssues);
  });

  it('should handle errors when fetching issues fails', async () => {
    const owner = 'owner';
    const repo = 'repo';
    const error = new Error('Failed to fetch');
    githubClientMock.getIssues.mockRejectedValueOnce(error);

    const result = await handler.handle(new FetchIssuesCommand(owner, repo));

    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
