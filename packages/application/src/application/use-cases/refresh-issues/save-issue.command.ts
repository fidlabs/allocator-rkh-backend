import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { LOG_MESSAGES } from '@src/constants';

const LOG = LOG_MESSAGES.UPSERT_ISSUE_COMMAND;

export class SaveIssueCommand extends Command {
  constructor(public readonly issueDetails: IssueDetails) {
    super();
  }
}

@injectable()
export class SaveIssueCommandHandler implements ICommandHandler<SaveIssueCommand> {
  commandToHandle: string = SaveIssueCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.IssueDetailsRepository) private readonly repository: IIssueDetailsRepository,
  ) {}

  async handle(command: SaveIssueCommand) {
    this.logger.info(LOG.UPSERTING_ISSUE);

    try {
      await this.repository.save(command.issueDetails);
      this.logger.info(LOG.ISSUE_UPSERTED);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(LOG.FAILED_TO_UPSERT_ISSUE, error);
      return {
        success: false,
        error: error,
      };
    }
  }
}
