import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { UpsertIssueStrategyResolver, UpsertStrategyKey } from './upsert-issue.strategy';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { Logger } from '@filecoin-plus/core';
import { SaveIssueCommand } from './save-issue.command';
import { SaveIssueWithNewAuditCommand } from './save-issue-with-new-audit.command';

describe('UpsertStrategy', () => {
  let container: Container;
  let strategy: UpsertIssueStrategyResolver;

  const repoMock = {
    findBy: vi.fn(),
    findWithLatestAuditBy: vi.fn(),
  };

  const loggerMock = { info: vi.fn() };

  const fixtureIssue: IssueDetails = {
    githubIssueId: 1,
    githubIssueNumber: 100,
    title: 't',
    creator: { userId: 1, name: 'u' },
    assignees: [],
    labels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    jsonNumber: '1001',
    state: 'open',
    refreshStatus: 'PENDING',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = new Container();
    container.bind(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repoMock as unknown as IIssueDetailsRepository);
    container.bind(TYPES.UpsertIssueStrategyResolver).to(UpsertIssueStrategyResolver);
    strategy = container.get<UpsertIssueStrategyResolver>(TYPES.UpsertIssueStrategyResolver);
  });

  it('returns SaveIssueWithNewAuditCommand when no issue by github id and no pending latest audit', async () => {
    repoMock.findBy.mockResolvedValue(null);
    repoMock.findWithLatestAuditBy.mockResolvedValue(null);

    const cmd = await strategy.resolveAndExecute(fixtureIssue);
    expect(cmd).toBeInstanceOf(SaveIssueWithNewAuditCommand);
  });

  it('returns SaveIssueCommand when issue exists and no pending latest audit', async () => {
    repoMock.findBy.mockResolvedValue({
      ...fixtureIssue,
      _id: 'x',
      refreshStatus: 'PENDING',
    } as any);
    repoMock.findWithLatestAuditBy.mockResolvedValue(null);

    const cmd = await strategy.resolveAndExecute(fixtureIssue);
    expect(cmd).toBeInstanceOf(SaveIssueCommand);
  });

  it('should update issue when issueByGithubId is the same as issueWithLatestAuditByJsonNumber', async () => {
    const githubIssueId = 1;

    repoMock.findBy.mockResolvedValue({
      ...fixtureIssue,
      githubIssueId,
    });
    repoMock.findWithLatestAuditBy.mockResolvedValue({
      ...fixtureIssue,
      githubIssueId,
    });

    const cmd = await strategy.resolveAndExecute(fixtureIssue);
    expect(cmd).toBeInstanceOf(SaveIssueCommand);
  });

  it('returns SaveIssueCommand when issues are related', async () => {
    const dbIssue = { ...fixtureIssue, _id: 'x', refreshStatus: 'PENDING' } as any;
    repoMock.findBy.mockResolvedValue(dbIssue);
    repoMock.findWithLatestAuditBy.mockResolvedValue(dbIssue);

    const cmd = await strategy.resolveAndExecute(fixtureIssue);
    expect(cmd).toBeInstanceOf(SaveIssueCommand);
  });

  it.each`
    refreshStatus     | expectedError
    ${'DC_ALLOCATED'} | ${'This issue refresh is already finished'}
    ${'REJECTED'}     | ${'This issue refresh is already finished'}
  `(
    'throws when issue by github id is finished state as $refreshStatus',
    async ({ refreshStatus, expectedError }) => {
      repoMock.findBy.mockResolvedValue({
        ...fixtureIssue,
        refreshStatus,
      } as any);
      repoMock.findWithLatestAuditBy.mockResolvedValue(null);

      await expect(strategy.resolveAndExecute(fixtureIssue)).rejects.toThrow(
        `${fixtureIssue.githubIssueNumber} ${expectedError}`,
      );
    },
  );

  it('throws when latest audit by jsonNumber is pending and not related', async () => {
    repoMock.findBy.mockResolvedValue(null);
    repoMock.findWithLatestAuditBy.mockResolvedValue({
      ...fixtureIssue,
      refreshStatus: 'PENDING',
    } as any);

    await expect(strategy.resolveAndExecute(fixtureIssue)).rejects.toThrow(
      'has pending audit, finish existing audit before creating a new one',
    );
  });
});
