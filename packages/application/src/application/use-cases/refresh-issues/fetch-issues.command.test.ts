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
  const issueMapperMock = { fromDomainListToIssueList: vi.fn(), extendWithAllocatorData: vi.fn() };
  const commandBusMock = { send: vi.fn() };

  const fixtureMsigAddress = `f2${faker.string.alphanumeric(38)}`;
  const fixureAllocatorData = {
    address: fixtureMsigAddress,
    pathway_addresses: { msig: fixtureMsigAddress },
    ma_address: 'f4',
    metapathway_type: 'AMA',
    allocator_id: '1',
  };

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
  const fixtureExtendedMappedIssue = {
    ...fixtureMappedIssues.at(0),
    address: fixureAllocatorData.address,
    msigAddress: fixureAllocatorData.pathway_addresses.msig,
    maAddress: fixureAllocatorData.ma_address,
    metapathwayType: fixureAllocatorData.metapathway_type,
    actorId: fixureAllocatorData.allocator_id,
  };

  const owner = 'owner';
  const repo = 'repo';

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
      data: fixureAllocatorData,
      success: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully fetch and map issues', async () => {
    githubClientMock.getIssues.mockResolvedValueOnce(fixtureIssues);
    issueMapperMock.fromDomainListToIssueList.mockReturnValueOnce(fixtureMappedIssues);
    issueMapperMock.extendWithAllocatorData.mockResolvedValue(fixtureExtendedMappedIssue);

    const result = await handler.handle(new FetchIssuesCommand(owner, repo));

    expect(issueMapperMock.fromDomainListToIssueList).toHaveBeenCalledWith(fixtureIssues);
    expect(issueMapperMock.extendWithAllocatorData).toHaveBeenCalledTimes(
      fixtureMappedIssues.length,
    );
    expect(issueMapperMock.extendWithAllocatorData).toHaveBeenCalledWith(
      fixtureMappedIssues.at(0),
      fixureAllocatorData,
    );
    expect(issueMapperMock.extendWithAllocatorData).toHaveBeenCalledWith(
      fixtureMappedIssues.at(1),
      fixureAllocatorData,
    );
    expect(issueMapperMock.extendWithAllocatorData).toHaveBeenCalledWith(
      fixtureMappedIssues.at(-1),
      fixureAllocatorData,
    );
    expect(result).toStrictEqual({
      success: true,
      data: [fixtureExtendedMappedIssue, fixtureExtendedMappedIssue, fixtureExtendedMappedIssue],
    });
    expect(githubClientMock.getIssues).toHaveBeenCalledWith(owner, repo);
  });

  it('should handle errors when fetching issues fails', async () => {
    const error = new Error('Failed to fetch');
    githubClientMock.getIssues.mockRejectedValueOnce(error);

    const result = await handler.handle(new FetchIssuesCommand(owner, repo));

    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
