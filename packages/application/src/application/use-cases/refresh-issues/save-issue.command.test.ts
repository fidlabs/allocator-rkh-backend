import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from '@filecoin-plus/core';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { SaveIssueCommand, SaveIssueCommandHandler } from './save-issue.command';
import { DatabaseRefreshFactory } from '@mocks/factories';

describe('SaveIssueCommand', () => {
  let container: Container;
  let handler: SaveIssueCommandHandler;

  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { save: vi.fn() };

  const issue = DatabaseRefreshFactory.create();

  beforeEach(() => {
    container = new Container();
    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<SaveIssueCommandHandler>(SaveIssueCommandHandler).toSelf();

    handler = container.get<SaveIssueCommandHandler>(SaveIssueCommandHandler);
    vi.clearAllMocks();
  });

  it('returns success true when repository.save succeeds', async () => {
    (repositoryMock.save as any).mockResolvedValueOnce(undefined);

    const result = await handler.handle(new SaveIssueCommand(issue));

    expect(repositoryMock.save).toHaveBeenCalledWith(issue);
    expect(result).toStrictEqual({ success: true });
  });

  it('returns success false when repository.save throws', async () => {
    const error = new Error('boom');
    (repositoryMock.save as any).mockRejectedValueOnce(error);

    const result = await handler.handle(new SaveIssueCommand(issue));

    expect(result).toStrictEqual({ success: false, error });
  });
});
