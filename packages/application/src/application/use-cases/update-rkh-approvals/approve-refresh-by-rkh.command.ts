import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
import { ApprovedTx } from '@src/infrastructure/clients/lotus';
import { LOG_MESSAGES } from '@src/constants';

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
    @inject(TYPES.IssueDetailsRepository)
    private readonly _repository: IIssueDetailsRepository,
  ) {}

  async handle(command: ApproveRefreshByRKHCommand) {
    try {
      this._logger.info(LOG.APPROVE_REFRESH_BY_RKH);
      const issueWithApprovedStatus: IssueDetails = {
        ...command.issueDetails,
        refreshStatus: 'DC_ALLOCATED',
        transactionCid: command.tx.cid,
      };

      await this._repository.update(issueWithApprovedStatus);

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
