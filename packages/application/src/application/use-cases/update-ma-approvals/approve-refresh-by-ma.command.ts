import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';
import {
  AuditHistory,
  IssueDetails,
  RefreshStatus,
} from '@src/infrastructure/repositories/issue-details';
import { LOG_MESSAGES } from '@src/constants';
import { Approval } from '@src/infrastructure/clients/lotus';
import { DataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { CommandBus } from '@src/infrastructure/command-bus';
import { SaveIssueCommand } from '../refresh-issues/save-issue.command';

const LOG = LOG_MESSAGES.APPROVE_REFRESH_BY_MA_COMMAND;

export class ApproveRefreshByMaCommand extends Command {
  constructor(
    public readonly issueDetails: IssueDetails,
    public readonly approval: Approval,
  ) {
    super();
  }
}

@injectable()
export class ApproveRefreshByMaCommandHandler
  implements ICommandHandler<ApproveRefreshByMaCommand>
{
  commandToHandle: string = ApproveRefreshByMaCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
    @inject(TYPES.CommandBus)
    private readonly _commandBus: CommandBus,
    @inject(TYPES.RefreshAuditService)
    private readonly _refreshAuditService: RefreshAuditService,
  ) {}

  async handle(command: ApproveRefreshByMaCommand) {
    try {
      this._logger.info(LOG.APPROVE_REFRESH_BY_MA);

      const auditResult = await this._refreshAuditService.finishAudit(
        command.issueDetails.jsonNumber,
      );
      const issueWithApprovedStatus = this.updateIssue(
        command.issueDetails,
        auditResult,
        command.approval,
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
    approval: Approval,
  ): IssueDetails {
    const auditHistory = issueDetails.auditHistory || [];
    auditHistory?.push(auditResult);

    return {
      ...issueDetails,
      refreshStatus: RefreshStatus.DC_ALLOCATED,
      transactionCid: approval.txHash,
      blockNumber: approval.blockNumber,
      metaAllocator: {
        blockNumber: approval.blockNumber,
      },
      currentAudit: {
        ...issueDetails.currentAudit,
        ...auditResult.auditChange,
      },
      auditHistory,
    };
  }
}
