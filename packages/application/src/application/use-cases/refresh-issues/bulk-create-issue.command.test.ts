import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from '@filecoin-plus/core';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { BulkCreateIssueCommand, BulkCreateIssueCommandHandler } from './bulk-create-issue.command';
import { DatabaseRefreshFactory } from '@mocks/factories';

describe('BulkCreateIssueCommand', () => {
  let container: Container;
  let handler: BulkCreateIssueCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() } as unknown as Logger;
  const repositoryMock = { bulkUpsertByField: vi.fn() };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<BulkCreateIssueCommandHandler>(BulkCreateIssueCommandHandler).toSelf();

    handler = container.get<BulkCreateIssueCommandHandler>(BulkCreateIssueCommandHandler);

    vi.clearAllMocks();
  });

  it('should successfully create multiple issues', async () => {
    const issues = [DatabaseRefreshFactory.create(), DatabaseRefreshFactory.create()];
    repositoryMock.bulkUpsertByField.mockResolvedValue(undefined);

    const result = await handler.handle(new BulkCreateIssueCommand(issues));

    expect(result.success).toBe(true);
    expect(repositoryMock.bulkUpsertByField).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when creating issues fails', async () => {
    const issues = [DatabaseRefreshFactory.create()];
    const error = new Error('Failed to save');
    repositoryMock.bulkUpsertByField.mockRejectedValue(error);

    const result = await handler.handle(new BulkCreateIssueCommand(issues));

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });
});
