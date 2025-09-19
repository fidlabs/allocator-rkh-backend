import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { LOG_MESSAGES } from '@src/constants';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { SaveIssueCommand } from './save-issue.command';

const LOG = LOG_MESSAGES.UPSERT_ISSUE_COMMAND;

export class SaveIssueWithNewAuditCommand extends Command {
  constructor(public readonly issueDetails: IssueDetails) {
    super();
  }
}

@injectable()
export class SaveIssueWithNewAuditCommandHandler
  implements ICommandHandler<SaveIssueWithNewAuditCommand>
{
  commandToHandle: string = SaveIssueWithNewAuditCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.RefreshAuditService) private readonly refreshAuditService: RefreshAuditService,
  ) {}

  async handle(command: SaveIssueWithNewAuditCommand) {
    this.logger.info(LOG.UPSERTING_ISSUE);

    try {
      const auditResult = await this.refreshAuditService.startAudit(
        command.issueDetails.jsonNumber,
      );
      const auditHistory = command.issueDetails.auditHistory || [];
      auditHistory.push(auditResult);

      const issueWithAudit = {
        ...command.issueDetails,
        auditHistory,
      };

      await this.commandBus.send(new SaveIssueCommand(issueWithAudit));
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
