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
import { IAuditMapper } from '@src/infrastructure/mappers/audit-mapper';
import { IUpsertStrategy, UpsertIssueStrategyResolver } from './upsert-issue.strategy';

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
    @inject(TYPES.AuditMapper) private readonly auditMapper: IAuditMapper,
    @inject(TYPES.UpsertIssueStrategyResolver)
    private readonly upsertStrategyResolver: UpsertIssueStrategyResolver,
  ) {}

  async handle(command: UpsertIssueCommand) {
    this.logger.info(command);

    try {
      this.logger.info('Connecting allocator to issue');
      const extendedIssueDetails = await this.connectAllocatorToIssue(command.githubIssue);

      this.logger.info('Resolving upsert strategy');

      const response = await this.commandBus.send(
        await this.upsertStrategyResolver.resolveAndExecute(extendedIssueDetails),
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

  private async connectAllocatorToIssue(issueDetails: IssueDetails): Promise<IssueDetails> {
    this.logger.info(LOG.CONNECTING_ALLOCATOR_TO_ISSUE);

    if (!issueDetails.jsonNumber) throw new Error(RES.JSON_HASH_IS_NOT_FOUND_OR_INCORRECT);

    const commandResponse = await this.commandBus.send(
      new FetchAllocatorCommand(issueDetails.jsonNumber),
    );
    this.logger.info(LOG.ALLOCATOR_CONNECTED_TO_ISSUE);

    if (commandResponse.error) throw commandResponse.error;
    const data = commandResponse.data as ApplicationPullRequestFile;

    const withAllocator = this.issueMapper.extendWithAllocatorData(issueDetails, data);
    const withAudits = this.extendIssueWithAuditData(withAllocator, data.audits);

    return withAudits;
  }

  private extendIssueWithAuditData(
    issueDetails: IssueDetails,
    audits: ApplicationPullRequestFile['audits'],
  ): IssueDetails {
    const currentAudit = audits?.at(-1);
    const previousAudit = audits?.at(-2);

    if (this.isPendingOrApproved(currentAudit!)) {
      issueDetails.lastAudit = this.auditMapper.fromDomainToAuditData(previousAudit!);
      issueDetails.currentAudit = this.auditMapper.fromDomainToAuditData(currentAudit!);
    } else {
      issueDetails.lastAudit = this.auditMapper.fromDomainToAuditData(currentAudit!);
    }

    return issueDetails;
  }

  private isPendingOrApproved(audit: AuditCycle): boolean {
    return [AuditOutcome.PENDING, AuditOutcome.APPROVED].includes(audit.outcome as AuditOutcome);
  }
}
