import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { TYPES } from '@src/types';
import { LOG_MESSAGES } from '@src/constants';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';

import { GithubClient, RepoIssue } from '@src/infrastructure/clients/github';
import { GithubConfig } from '@src/domain/types';
import { UpsertIssueCommand } from './upsert-issue.command';

const LOG = LOG_MESSAGES.SYNC_ISSUE_COMMAND;

export class SyncIssueCommand extends Command {
  constructor(public readonly githubIssueNumber: number) {
    super();
  }
}

@injectable()
export class SyncIssueCommandCommandHandler implements ICommandHandler<SyncIssueCommand> {
  commandToHandle: string = SyncIssueCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.IssueMapper) private readonly issueMapper: IIssueMapper,
    @inject(TYPES.GithubClient) private readonly githubClient: GithubClient,
    @inject(TYPES.AllocatorGovernanceConfig)
    private readonly allocatorGovernanceConfig: GithubConfig,
  ) {}

  async handle(command: SyncIssueCommand) {
    this.logger.info(command);

    try {
      const repoIssue = await this.fetchIssueData(command.githubIssueNumber);
      const mappedIssue = this.handleMapIssue(repoIssue);
      const response = await this.commandBus.send(new UpsertIssueCommand(mappedIssue));

      if (!response?.success) throw response.error;

      return {
        success: true,
      };
    } catch (e) {
      this.logger.error(LOG.FAILED_TO_SYNC_ISSUE, e);

      return {
        success: false,
        error: e,
      };
    }
  }

  private async fetchIssueData(githubIssueNumber: number): Promise<RepoIssue> {
    try {
      this.logger.info(LOG.SYNCING_ISSUE);

      const issue = await this.githubClient.getIssue(
        this.allocatorGovernanceConfig.owner,
        this.allocatorGovernanceConfig.repo,
        githubIssueNumber,
      );

      this.logger.info(LOG.ISSUE_SYNCED);

      return issue;
    } catch (e) {
      this.logger.error(LOG.FAILED_TO_SYNC_ISSUE, e);
      throw e;
    }
  }

  private handleMapIssue(repoIssue: RepoIssue): IssueDetails {
    this.logger.info(LOG.MAPPING_ISSUE);

    const mappedIssue = this.issueMapper.fromDomainToIssue(repoIssue);
    this.logger.info(LOG.ISSUE_MAPPED);

    return mappedIssue;
  }
}
