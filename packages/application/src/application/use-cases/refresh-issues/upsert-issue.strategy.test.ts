import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { UpsertIssueStrategyResolver } from './upsert-issue.strategy';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { Logger } from '@filecoin-plus/core';
import { SaveIssueCommand } from './save-issue.command';
import { SaveIssueWithNewAuditCommand } from './save-issue-with-new-audit.command';
import { AuditCycle } from '@src/application/services/pull-request.types';

describe('UpsertStrategy', () => {
  let container: Container;
  let strategy: UpsertIssueStrategyResolver;

  const repoMock = {
    findBy: vi.fn(),
    findLatestBy: vi.fn(),
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

  const fixturePendingAudit: AuditCycle = {
    started: '2024-01-01T00:00:00.000Z',
    ended: '',
    dc_allocated: '',
    outcome: 'PENDING',
    datacap_amount: '',
  };

  const fixtureGantedAudit: AuditCycle = {
    started: '2024-01-01T00:00:00.000Z',
    ended: '2024-01-02T00:00:00.000Z',
    dc_allocated: '2024-01-03T00:00:00.000Z',
    outcome: 'GRANTED',
    datacap_amount: 1,
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
    repoMock.findLatestBy.mockResolvedValue(null);

    const cmd = await strategy.resolveAndExecute(fixtureIssue, [fixtureGantedAudit]);
    expect(cmd).toBeInstanceOf(SaveIssueWithNewAuditCommand);
  });

  it('returns SaveIssueCommand when issue exists and no pending latest audit', async () => {
    repoMock.findBy.mockResolvedValue(fixtureIssue);
    repoMock.findLatestBy.mockResolvedValue({
      ...fixtureIssue,
      refreshStatus: 'DC_ALLOCATED',
      githubIssueId: 2,
      githubIssueNumber: 200,
    });

    const cmd = await strategy.resolveAndExecute(fixtureIssue, [fixtureGantedAudit]);
    expect(cmd).toBeInstanceOf(SaveIssueWithNewAuditCommand);
  });

  it('should save issue with new github audit, when issue is related to last pending audit and audit is finished', async () => {
    repoMock.findBy.mockResolvedValue(fixtureIssue);
    repoMock.findLatestBy.mockResolvedValue(fixtureIssue);

    const cmd = await strategy.resolveAndExecute(fixtureIssue, [fixturePendingAudit]);
    expect(cmd).toBeInstanceOf(SaveIssueCommand);
  });

  it('should save issue with new github audit, when issue is related to last pending audit and audit is finished', async () => {
    repoMock.findBy.mockResolvedValue(fixtureIssue);
    repoMock.findLatestBy.mockResolvedValue(fixtureIssue);

    const cmd = await strategy.resolveAndExecute(fixtureIssue, [fixtureGantedAudit]);
    expect(cmd).toBeInstanceOf(SaveIssueWithNewAuditCommand);
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
      });
      repoMock.findLatestBy.mockResolvedValue(null);

      await expect(strategy.resolveAndExecute(fixtureIssue, [fixtureGantedAudit])).rejects.toThrow(
        `${fixtureIssue.githubIssueNumber} ${expectedError}`,
      );
    },
  );

  it('throws when latest audit by jsonNumber is pending and not related', async () => {
    repoMock.findBy.mockResolvedValue(null);
    repoMock.findLatestBy.mockResolvedValue({
      ...fixtureIssue,
      refreshStatus: 'PENDING',
    });

    await expect(strategy.resolveAndExecute(fixtureIssue, [fixturePendingAudit])).rejects.toThrow(
      `${fixtureIssue.jsonNumber} has pending audit, finish existing refresh before creating a new one`,
    );
  });
});
