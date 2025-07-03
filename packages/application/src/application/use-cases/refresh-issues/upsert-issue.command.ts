import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { LOG_MESSAGES } from '@src/constants';
import { FetchAllocatorCommand } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';

const LOG = LOG_MESSAGES.UPSERT_ISSUE_COMMAND;

export class UpsertIssueCommand extends Command {
  constructor(public readonly githubIssue: IssueDetails) {
    super();
  }
}

@injectable()
export class UpsertIssueCommandCommandHandler implements ICommandHandler<UpsertIssueCommand> {
  commandToHandle: string = UpsertIssueCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.IssueDetailsRepository) private readonly repository: IIssueDetailsRepository,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
  ) {}

  async handle(command: UpsertIssueCommand) {
    this.logger.info(command);

    try {
      const extendedIssueDetails = await this.connectMsigToIssue(command.githubIssue);
      await this.saveIssue(extendedIssueDetails);

      return {
        success: true,
      };
    } catch (e) {
      this.logger.error(LOG.FAILED_TO_UPSERT_ISSUE, e);

      return {
        success: false,
        error: e,
      };
    }
  }

  async saveIssue(issueDetails: IssueDetails) {
    this.logger.info(LOG.UPSERTING_ISSUE);

    await this.repository.save(issueDetails);
    this.logger.info(LOG.ISSUE_UPSERTED);
  }

  async connectMsigToIssue(issueDetails: IssueDetails): Promise<IssueDetails> {
    this.logger.info(LOG.CONNECTING_ALLOCATOR_TO_ISSUE);

    if (!issueDetails.jsonNumber) throw new Error('Issue does not have a jsonNumber');

    const commandResponse = await this.commandBus.send(
      new FetchAllocatorCommand(issueDetails.jsonNumber),
    );
    this.logger.info(LOG.ALLOCATOR_CONNECTED_TO_ISSUE);

    if (commandResponse.error) throw commandResponse.error;

    return {
      ...issueDetails,
      msigAddress: commandResponse.data.pathway_addresses.msig,
    };
  }
}
