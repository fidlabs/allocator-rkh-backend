import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';
import { IssueDetails, RefreshStatus } from '@src/infrastructure/repositories/issue-details';
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
    @inject(TYPES.DataCapMapper)
    private readonly _dataCapMapper: DataCapMapper,
    @inject(TYPES.RefreshAuditService)
    private readonly _refreshAuditService: RefreshAuditService,
  ) {}

  async handle(command: ApproveRefreshByMaCommand) {
    try {
      this._logger.info(LOG.APPROVE_REFRESH_BY_MA);

      const dataCap = this._dataCapMapper.fromBigIntBytesToPiBNumber(
        BigInt(command.approval.allowanceAfter) - BigInt(command.approval.allowanceBefore),
      );
      const auditResult = await this._refreshAuditService.approveAudit(
        command.issueDetails.jsonNumber,
      );

      const auditHistory = command.issueDetails.auditHistory || [];
      auditHistory?.push(auditResult);

      const issueWithApprovedStatus: IssueDetails = {
        ...command.issueDetails,
        refreshStatus: RefreshStatus.DC_ALLOCATED,
        transactionCid: command.approval.txHash,
        blockNumber: command.approval.blockNumber,
        metaAllocator: {
          blockNumber: command.approval.blockNumber,
        },
        currentAudit: {
          ...command.issueDetails.currentAudit,
          ...auditResult.auditChange,
        },
        dataCap,
        auditHistory,
      };

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
}
