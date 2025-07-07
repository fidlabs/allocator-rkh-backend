import { Command, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { LOG_MESSAGES } from '@src/constants';

const LOG = LOG_MESSAGES.BULK_CREATE_ISSUE_COMMAND;

export class BulkCreateIssueCommand extends Command {
  constructor(public readonly githubIssues: IssueDetails[]) {
    super();
  }
}

@injectable()
export class BulkCreateIssueCommandHandler {
  commandToHandle: string = BulkCreateIssueCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.IssueDetailsRepository)
    private readonly repository: IIssueDetailsRepository,
  ) {}

  async handle(command: BulkCreateIssueCommand) {
    try {
      const bulkResults = await this.bulkUpsertIssues(command.githubIssues);

      return {
        success: true,
        data: bulkResults,
      };
    } catch (e) {
      this.logger.error(LOG.FAILED_TO_CREATE_ISSUES, e);
      return {
        success: false,
        error: e,
      };
    }
  }

  async bulkUpsertIssues(issueDetails: IssueDetails[]) {
    this.logger.info(LOG.BULK_CREATING_ISSUES);

    const bulkResults = await this.repository.bulkUpsertByField(issueDetails, 'githubIssueId');
    this.logger.info(LOG.ISSUES_CREATED);

    return bulkResults;
  }
}
