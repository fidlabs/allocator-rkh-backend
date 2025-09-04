import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RefreshAuditPublisher } from './refresh-audit-publisher';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { Container } from 'inversify';
import { GithubClient } from '@src/infrastructure/clients/github';
import { TYPES } from '@src/types';
import { GithubConfig } from '@src/domain/types';
import { ICommandBus } from '@filecoin-plus/core/src/interfaces/ICommandBus';
import { AuditMapper, IAuditMapper } from '@src/infrastructure/mappers/audit-mapper';

describe('RefreshAuditPublisher', () => {
  let container: Container;
  let publisher: RefreshAuditPublisher;

  const githubMock = {
    createBranch: vi.fn(),
    createPullRequest: vi.fn(),
    mergePullRequest: vi.fn(),
    deleteBranch: vi.fn(),
  };
  const configMock = { owner: 'owner', repo: 'repo' };
  const commandBusMock = { send: vi.fn() };
  const auditMapperMock = {
    fromAuditDataToDomain: vi.fn(a => ({
      started: a.started,
      ended: a.ended,
      dc_allocated: a.dcAllocated,
      outcome: a.outcome,
      datacap_amount: a.datacapAmount as number,
    })),
    partialFromAuditDataToDomain: vi.fn(a => ({
      started: a.started,
      ended: a.ended,
      dc_allocated: a.dcAllocated,
      outcome: a.outcome,
      datacap_amount: a.datacapAmount as number,
    })),
  };

  const baseAllocator = {
    application_number: 123,
    audits: [
      {
        started: '2023-01-01T00:00:00.000Z',
        ended: '2023-01-02T00:00:00.000Z',
        dc_allocated: '2023-01-03T00:00:00.000Z',
        outcome: AuditOutcome.MATCH,
        datacap_amount: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    vi.clearAllMocks();

    container = new Container();
    container
      .bind<GithubClient>(TYPES.GithubClient)
      .toConstantValue(githubMock as unknown as GithubClient);
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<IAuditMapper>(TYPES.AuditMapper)
      .toConstantValue(auditMapperMock as unknown as IAuditMapper);
    container
      .bind(TYPES.AllocatorRegistryConfig)
      .toConstantValue(configMock as unknown as GithubConfig);
    container.bind<RefreshAuditPublisher>(RefreshAuditPublisher).toSelf();

    publisher = container.get<RefreshAuditPublisher>(RefreshAuditPublisher);

    githubMock.createBranch.mockResolvedValue({ ref: 'refs/heads/b' });
    githubMock.createPullRequest.mockResolvedValue({
      number: 10,
      head: { sha: 'abc' },
      html_url: 'url',
    });
    githubMock.mergePullRequest.mockResolvedValue({});
    githubMock.deleteBranch.mockResolvedValue({});

    commandBusMock.send.mockResolvedValue({ success: true, data: structuredClone(baseAllocator) });
  });

  it('newAudit creates a new pending audit and publishes PR', async () => {
    const result = await publisher.newAudit('hash123');

    expect(commandBusMock.send).toHaveBeenCalled();
    expect(githubMock.createBranch).toHaveBeenCalled();
    expect(githubMock.createPullRequest).toHaveBeenCalled();
    expect(githubMock.mergePullRequest).toHaveBeenCalled();
    expect(githubMock.deleteBranch).toHaveBeenCalled();

    expect(result.prNumber).toBe(10);
    expect(result.commitSha).toBe('abc');
    expect(result.auditChange.outcome).toBe(AuditOutcome.PENDING);
    expect(result.auditChange.started).toBe('2024-01-01T00:00:00.000Z');
  });

  it.each([AuditOutcome.PENDING, AuditOutcome.APPROVED])(
    'newAudit throws when last audit is %s',
    async outcome => {
      const pendingAllocator = structuredClone(baseAllocator);
      pendingAllocator.audits[pendingAllocator.audits.length - 1].outcome = outcome;
      commandBusMock.send.mockResolvedValueOnce({ success: true, data: pendingAllocator });

      await expect(publisher.newAudit('hash123')).rejects.toThrow('Pending audit found');
    },
  );

  it('updateAudit applies partial changes to latest audit and publishes PR', async () => {
    const change = { ended: '2024-01-02T00:00:00.000Z', outcome: AuditOutcome.APPROVED } as any;

    const result = await publisher.updateAudit('hash123', change);

    expect(auditMapperMock.partialFromAuditDataToDomain).toHaveBeenCalledWith(change);
    expect(githubMock.createPullRequest).toHaveBeenCalled();
    expect(result.prNumber).toBe(10);
    expect(result.auditChange).toEqual(change);
  });
});
