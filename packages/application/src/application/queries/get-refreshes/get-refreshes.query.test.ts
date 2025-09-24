import { Container } from 'inversify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetRefreshesQuery, GetRefreshesQueryHandler } from './get-refreshes.query';
import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';

describe('GetRefreshesQuery', () => {
  let container: Container;
  let handler: GetRefreshesQueryHandler;

  const repositoryMock = {
    getPaginated: vi.fn().mockResolvedValue('fixtureRepositoryResponse'),
  };

  beforeEach(() => {
    container = new Container();
    container.bind<GetRefreshesQueryHandler>(GetRefreshesQueryHandler).toSelf();
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    handler = container.get(GetRefreshesQueryHandler);
  });

  it('should be defined', () => {
    expect(GetRefreshesQueryHandler).toBeDefined();
  });

  it('should execute the query', async () => {
    const query = new GetRefreshesQuery(1, 10, 'test', [RefreshStatus.PENDING]);
    const result = await handler.execute(query);

    expect(result).toBe('fixtureRepositoryResponse');
    expect(repositoryMock.getPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: 'test',
      filters: {
        refreshStatus: [RefreshStatus.PENDING],
      },
    });
  });

  it('should throw an error when the repository throws an error', async () => {
    const error = new Error('test error');
    repositoryMock.getPaginated.mockRejectedValue(error);

    const query = new GetRefreshesQuery(1, 10, 'test', [RefreshStatus.PENDING]);
    await expect(handler.execute(query)).rejects.toThrow(error);

    expect(repositoryMock.getPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: 'test',
      filters: {
        refreshStatus: [RefreshStatus.PENDING],
      },
    });
  });

  it('should be called without optional parameters', async () => {
    const query = new GetRefreshesQuery();
    const result = await handler.execute(query);

    expect(result).toBe('fixtureRepositoryResponse');
    expect(repositoryMock.getPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
  });
});
