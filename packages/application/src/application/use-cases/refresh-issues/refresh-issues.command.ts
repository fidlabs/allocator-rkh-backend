import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { FetchIssuesCommand } from '@src/application/use-cases/refresh-issues/fetch-issues.command';
import config from '@src/config';
import { LOG_MESSAGES } from '@src/constants';
import { BulkCreateIssueCommand } from '@src/application/use-cases/refresh-issues/bulk-create-issue.command';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { BulkWriteResult } from 'mongodb';

const LOG = LOG_MESSAGES.REFRESH_ISSUES_COMMAND;

export class RefreshIssuesCommand extends Command {
  constructor() {
    super();
  }
}

@injectable()
export class RefreshIssuesCommandHandler implements ICommandHandler<RefreshIssuesCommand> {
  commandToHandle: string = RefreshIssuesCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.CommandBus)
    private readonly commandBus: ICommandBus,
  ) {}

  async handle(command: RefreshIssuesCommand): Promise<any> {
    this.logger.info(command);

    try {
      const issuesDetails = await this.handleFetchIssues();
      const bulkResults = await this.handleBulkCreateIssue(issuesDetails);

      return {
        success: true,
        data: bulkResults,
      };
    } catch (error) {
      this.logger.error(LOG.REFETCHING_FAILED, error);

      return {
        success: false,
        error: error,
      };
    }
  }

  private async handleFetchIssues(): Promise<IssueDetails[]> {
    this.logger.info(LOG.REFRESHING_ISSUES);

    const commandResponse = await this.commandBus.send(
      new FetchIssuesCommand(config.GITHUB_ISSUES_OWNER, config.GITHUB_ISSUES_REPO),
    );

    if (commandResponse.error) throw commandResponse.error;
    return commandResponse.data;
  }

  private async handleBulkCreateIssue(issuesDetails: IssueDetails[]): Promise<BulkWriteResult> {
    this.logger.info(LOG.UPDATING_ISSUES);

    const commandResponse = await this.commandBus.send(new BulkCreateIssueCommand(issuesDetails));

    if (commandResponse.error) throw commandResponse.error;
    return commandResponse.data;
  }
}
