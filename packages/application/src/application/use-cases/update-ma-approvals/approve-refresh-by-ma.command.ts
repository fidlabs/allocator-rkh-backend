import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';
import { LOG_MESSAGES } from '@src/constants';
import { Approval } from '@src/infrastructure/clients/lotus';
import { DataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';

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
    @inject(TYPES.IssueDetailsRepository)
    private readonly _repository: IIssueDetailsRepository,
    @inject(TYPES.DataCapMapper)
    private readonly _dataCapMapper: DataCapMapper,
  ) {}

  async handle(command: ApproveRefreshByMaCommand) {
    try {
      this._logger.info(LOG.APPROVE_REFRESH_BY_MA);

      const issueWithApprovedStatus: IssueDetails = {
        ...command.issueDetails,
        refreshStatus: 'DC_ALLOCATED',
        transactionCid: command.approval.txHash,
        blockNumber: command.approval.blockNumber,
        metaAllocator: {
          blockNumber: command.approval.blockNumber,
        },
        dataCap: this._dataCapMapper.fromBigIntBytesToPiBNumber(
          BigInt(command.approval.allowanceAfter) - BigInt(command.approval.allowanceBefore),
        ),
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
