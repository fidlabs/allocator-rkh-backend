import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';
import {
  AuditHistory,
  IssueDetails,
  RefreshStatus,
} from '@src/infrastructure/repositories/issue-details';
import { ApprovedTx } from '@src/infrastructure/clients/lotus';
import { LOG_MESSAGES } from '@src/constants';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { SaveIssueCommand } from '../refresh-issues/save-issue.command';
import { CommandBus } from '@src/infrastructure/command-bus';

const LOG = LOG_MESSAGES.APPROVE_REFRESH_BY_RKH_COMMAND;

export class ApproveRefreshByRKHCommand extends Command {
  constructor(
    public readonly issueDetails: IssueDetails,
    public readonly tx: ApprovedTx,
  ) {
    super();
  }
}

@injectable()
export class ApproveRefreshByRKHCommandHandler
  implements ICommandHandler<ApproveRefreshByRKHCommand>
{
  commandToHandle: string = ApproveRefreshByRKHCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
    @inject(TYPES.CommandBus)
    private readonly _commandBus: CommandBus,
    @inject(TYPES.RefreshAuditService)
    private readonly _refreshAuditService: RefreshAuditService,
  ) {}

  async handle(command: ApproveRefreshByRKHCommand) {
    try {
      this._logger.info(LOG.APPROVE_REFRESH_BY_RKH);

      const auditResult = await this._refreshAuditService.finishAudit(
        command.issueDetails.jsonNumber,
        {
          newDatacapAmount: command.issueDetails.dataCap,
          dcAllocatedDate: new Date(command.tx.timestamp * 1000).toISOString(),
        },
      );

      const issueWithApprovedStatus = this.updateIssue(
        command.issueDetails,
        auditResult,
        command.tx,
      );
      await this._commandBus.send(new SaveIssueCommand(issueWithApprovedStatus));

      this._logger.info(LOG.REFRESH_APPROVED);
      return {
        success: true,
      };
    } catch (error) {
      this._logger.error(LOG.FAILED_TO_APPROVE_REFRESH, error);
      return {
        success: false,
        error,
      };
    }
  }

  private updateIssue(
    issueDetails: IssueDetails,
    auditResult: AuditHistory,
    tx: ApprovedTx,
  ): IssueDetails {
    const auditHistory = issueDetails.auditHistory || [];
    auditHistory?.push(auditResult);

    return {
      ...issueDetails,
      refreshStatus: RefreshStatus.DC_ALLOCATED,
      transactionCid: tx.cid,
      auditHistory,
    };
  }
}
