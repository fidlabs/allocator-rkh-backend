import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { AuditOutcome, IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '@src/constants';
import { FetchAllocatorCommand } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import {
  ApplicationPullRequestFile,
  AuditCycle,
} from '@src/application/services/pull-request.types';

import { UpsertIssueStrategyResolver } from './upsert-issue.strategy';
import { a } from 'vitest/dist/chunks/suite.d.FvehnV49';

const LOG = LOG_MESSAGES.UPSERT_ISSUE_COMMAND;
const RES = RESPONSE_MESSAGES.UPSERT_ISSUE_COMMAND;

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
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.IssueMapper) private readonly issueMapper: IIssueMapper,
    @inject(TYPES.UpsertIssueStrategyResolver)
    private readonly upsertStrategyResolver: UpsertIssueStrategyResolver,
  ) {}

  async handle(command: UpsertIssueCommand) {
    this.logger.info(command);

    try {
      this.logger.info(LOG.CONNECTING_ALLOCATOR_TO_ISSUE);
      const allocatorData = await this.fetchAllocatorData(command.githubIssue);
      const extendedIssueDetails = await this.connectAllocatorToIssue(
        command.githubIssue,
        allocatorData,
      );

      this.logger.info(LOG.RESOLVING_UPSERT_STRATEGY);

      const response = await this.commandBus.send(
        await this.upsertStrategyResolver.resolveAndExecute(
          extendedIssueDetails,
          allocatorData.audits,
        ),
      );

      if (!response?.success) throw response.error;

      this.logger.info('Issue upserted successfully');
      this.logger.info(response);

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

  private async fetchAllocatorData(
    issueDetails: IssueDetails,
  ): Promise<ApplicationPullRequestFile> {
    const commandResponse = await this.commandBus.send(
      new FetchAllocatorCommand(issueDetails.jsonNumber),
    );
    if (!commandResponse.success) throw commandResponse.error;

    return commandResponse.data as ApplicationPullRequestFile;
  }

  private async connectAllocatorToIssue(
    issueDetails: IssueDetails,
    allocatorData: ApplicationPullRequestFile,
  ): Promise<IssueDetails> {
    this.logger.info(LOG.CONNECTING_ALLOCATOR_TO_ISSUE);

    if (!issueDetails.jsonNumber) throw new Error(RES.JSON_HASH_IS_NOT_FOUND_OR_INCORRECT);

    const extendedIssueDetails = this.issueMapper.extendWithAllocatorData(
      issueDetails,
      allocatorData,
    );
    this.logger.info(LOG.ALLOCATOR_CONNECTED_TO_ISSUE);

    return extendedIssueDetails;
  }
}
