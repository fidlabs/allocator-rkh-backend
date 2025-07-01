import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { UpsertIssueCommand, UpsertIssueCommandCommandHandler } from './upsert-issue.command';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';

describe('UpsertIssueCommand', () => {
  let container: Container;
  let handler: UpsertIssueCommandCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { save: vi.fn() };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<UpsertIssueCommandCommandHandler>(UpsertIssueCommandCommandHandler).toSelf();

    handler = container.get<UpsertIssueCommandCommandHandler>(UpsertIssueCommandCommandHandler);
  });

  it('should successfully upsert issue', async () => {
    const issueDetails: IssueDetails = {
      githubIssueId: 1,
      title: 'Test Issue',
      creator: { userId: 1, name: 'test-user' },
      assignees: [],
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      jsonNumber: 'rec123',
      state: 'open',
    };

    const command = new UpsertIssueCommand(issueDetails);
    const result = await handler.handle(command);

    expect(result.success).toBe(true);
    expect(repositoryMock.save).toHaveBeenCalledWith(issueDetails);
  });

  it('should handle error during issue upsert', async () => {
    const error = new Error('Failed to save');
    repositoryMock.save.mockRejectedValue(error);

    const issueDetails: IssueDetails = {
      githubIssueId: 1,
      title: 'Test Issue',
      creator: { userId: 1, name: 'test-user' },
      assignees: [],
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      jsonNumber: 'rec123',
      state: 'open',
    };

    const command = new UpsertIssueCommand(issueDetails);
    const result = await handler.handle(command);

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
