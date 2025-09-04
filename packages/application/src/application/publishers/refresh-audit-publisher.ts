import { inject, injectable } from 'inversify';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { FetchAllocatorCommand } from '../use-cases/fetch-allocator/fetch-allocator.command';
import { ApplicationPullRequestFile, AuditCycle } from '../services/pull-request.types';
import { AuditData, AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { GithubConfig } from '@src/domain/types';
import { IAuditMapper } from '@src/infrastructure/mappers/audit-mapper';
import { nanoid } from 'nanoid';

export interface IRefreshAuditPublisher {
  newAudit(jsonHash: string): Promise<{
    auditChange: AuditData;
    branchName: string;
    commitSha: string;
    prNumber: number;
    prUrl: string;
  }>;

  updateAudit(
    jsonHash: string,
    auditData: AuditData,
  ): Promise<{
    branchName: string;
    commitSha: string;
    prNumber: number;
    prUrl: string;
  }>;
}

@injectable()
export class RefreshAuditPublisher implements IRefreshAuditPublisher {
  constructor(
    @inject(TYPES.Logger) private readonly _logger: Logger,
    @inject(TYPES.GithubClient) private readonly _github: IGithubClient,
    @inject(TYPES.AllocatorRegistryConfig) private readonly _allocatorRegistryConfig: GithubConfig,
    @inject(TYPES.CommandBus) private readonly _commandBus: ICommandBus,
    @inject(TYPES.AuditMapper) private readonly _auditMapper: IAuditMapper,
  ) {}

  async newAudit(jsonHash: string): Promise<{
    branchName: string;
    commitSha: string;
    prNumber: number;
    prUrl: string;
    auditChange: AuditData;
  }> {
    const { allocator } = await this.getAllocatorJsonDetails(jsonHash);
    const newAudit: AuditData = {
      started: new Date().toISOString(),
      ended: '',
      dcAllocated: '',
      outcome: AuditOutcome.PENDING,
      datacapAmount: '',
    };

    if (allocator.audits.at(-1)?.outcome === AuditOutcome.PENDING)
      throw new Error('Pending audit found');

    allocator.audits.push(this._auditMapper.fromAuditDataToDomain(newAudit));

    const result = await this.publish(jsonHash, allocator);

    return {
      auditChange: newAudit,
      ...result,
    };
  }

  async updateAudit(
    jsonHash: string,
    auditData: Partial<AuditData> | ((jsonA: ApplicationPullRequestFile) => Partial<AuditData>),
  ): Promise<{
    auditChange: Partial<AuditData>;
    branchName: string;
    commitSha: string;
    prNumber: number;
    prUrl: string;
  }> {
    const { allocator } = await this.getAllocatorJsonDetails(jsonHash);

    const auditDataToUpdate = typeof auditData === 'function' ? auditData(allocator!) : auditData;

    Object.entries(this._auditMapper.partialFromAuditDataToDomain(auditDataToUpdate)).forEach(
      ([key, value]) => {
        allocator.audits[allocator.audits.length - 1][key] = value;
      },
    );

    const result = await this.publish(jsonHash, allocator);

    return {
      auditChange: auditDataToUpdate,
      ...result,
    };
  }

  private async getAllocatorJsonDetails(jsonHash: string) {
    const result = await this._commandBus.send(new FetchAllocatorCommand(jsonHash));

    if (!result.success) throw new Error('Failed to fetch allocator JSON');
    const allocator = result.data as ApplicationPullRequestFile;

    const lastAudit = allocator.audits.at(-1);
    if (!lastAudit) throw new Error('No audit found');

    return {
      allocator,
      lastAudit,
    };
  }

  private async publish(jsonHash: string, allocator: ApplicationPullRequestFile) {
    const branchName = `refresh-audit-${jsonHash}-${allocator.audits.length}-${nanoid()}`;
    const prTitle = `Refresh Audit ${allocator.application_number} - ${allocator.audits.length}`;
    const prBody = `This PR is a refresh audit for the application ${allocator.application_number}.`;

    const branch = await this._github.createBranch(
      this._allocatorRegistryConfig.owner,
      this._allocatorRegistryConfig.repo,
      branchName,
      'main',
    );

    const files = [
      {
        path: `Allocators/${jsonHash}.json`,
        content: JSON.stringify(allocator, null, 2),
      },
    ];

    const pr = await this._github.createPullRequest(
      this._allocatorRegistryConfig.owner,
      this._allocatorRegistryConfig.repo,
      prTitle,
      prBody,
      branch.ref,
      'main',
      files,
    );

    await this._github.mergePullRequest(
      this._allocatorRegistryConfig.owner,
      this._allocatorRegistryConfig.repo,
      pr.number,
      `Refresh Audit ${jsonHash} ${allocator.audits.length} - ${allocator.application_number}`,
    );

    await this._github.deleteBranch(
      this._allocatorRegistryConfig.owner,
      this._allocatorRegistryConfig.repo,
      branchName,
    );

    return {
      branchName,
      commitSha: pr.head.sha,
      prNumber: pr.number,
      prUrl: pr.html_url,
    };
  }
}
