import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { LOG_MESSAGES } from '@src/constants';
import {
  AuditHistory,
  IssueDetails,
  RefreshStatus,
} from '@src/infrastructure/repositories/issue-details';
import { SaveIssueCommand } from './save-issue.command';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';

const LOG = LOG_MESSAGES.UPSERT_ISSUE_COMMAND;

export class ApproveRefreshCommand extends Command {
  constructor(
    public readonly githubIssueNumber: number,
    public readonly datacapAmount: number,
  ) {
    super();
  }
}

@injectable()
export class ApproveRefreshCommandHandler implements ICommandHandler<ApproveRefreshCommand> {
  commandToHandle: string = ApproveRefreshCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.RefreshAuditService) private readonly refreshAuditService: RefreshAuditService,
    @inject(TYPES.IssueDetailsRepository)
    private readonly issueDetailsRepository: IIssueDetailsRepository,
  ) {}

  async handle(command: ApproveRefreshCommand) {
    this.logger.info(LOG.UPSERTING_ISSUE);

    try {
      const issueDetails = await this.getIssueDetailsOrThrow(command.githubIssueNumber);
      const auditResult = await this.refreshAuditService.approveAudit(
        issueDetails.jsonNumber,
        command.datacapAmount,
      );
      const issueDetailsWithUpdatedAudit = this.updateAudit(issueDetails, auditResult);
      await this.saveIssueOrThrow(issueDetailsWithUpdatedAudit);

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

  private async getIssueDetailsOrThrow(githubIssueNumber: number): Promise<IssueDetails> {
    const issueDetails = await this.issueDetailsRepository.findPendingBy({ githubIssueNumber });
    if (!issueDetails) {
      throw new Error(
        `Cannot approve audit refresh because it is not in the correct status. GithubIssueNumber: ${githubIssueNumber}`,
      );
    }
    return issueDetails;
  }

  private updateAudit(issueDetails: IssueDetails, auditResult: AuditHistory): IssueDetails {
    const auditHistory = issueDetails.auditHistory || [];
    auditHistory.push(auditResult);

    return {
      ...issueDetails,
      refreshStatus: RefreshStatus.APPROVED,
      currentAudit: {
        ...issueDetails.currentAudit,
        ...auditResult.auditChange,
      },
      auditHistory,
    };
  }

  private async saveIssueOrThrow(issueDetails: IssueDetails) {
    const result = await this.commandBus.send(new SaveIssueCommand(issueDetails));
    if (!result.success) throw result.error;
  }
}
