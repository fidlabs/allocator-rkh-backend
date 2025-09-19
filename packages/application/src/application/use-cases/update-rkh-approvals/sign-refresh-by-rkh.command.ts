import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { IssueDetails, RefreshStatus } from '@src/infrastructure/repositories/issue-details';
import { PendingTx } from '@src/infrastructure/clients/lotus';
import { LOG_MESSAGES } from '@src/constants';
import cbor from 'cbor';
import { DataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';
import { SaveIssueCommand } from '../refresh-issues/save-issue.command';
import { CommandBus } from '@src/infrastructure/command-bus';

export class SignRefreshByRKHCommand extends Command {
  constructor(
    public readonly issueDetails: IssueDetails,
    public readonly tx: PendingTx,
  ) {
    super();
  }
}

const LOG = LOG_MESSAGES.SIGN_REFRESH_BY_RKH_COMMAND;

@injectable()
export class SignRefreshByRKHCommandHandler implements ICommandHandler<SignRefreshByRKHCommand> {
  commandToHandle: string = SignRefreshByRKHCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
    @inject(TYPES.CommandBus)
    private readonly _commandBus: CommandBus,
  ) {}

  async handle(command: SignRefreshByRKHCommand) {
    try {
      this._logger.info(LOG.SIGN_REFRESH_BY_RKH);
      const issueWithSignedStatus = this.updateIssue(command.issueDetails, command.tx);

      await this._commandBus.send(new SaveIssueCommand(issueWithSignedStatus));
      this._logger.info(LOG.REFRESH_SIGNED);

      return {
        success: true,
      };
    } catch (error) {
      this._logger.error(LOG.FAILED_TO_SIGN_REFRESH, error);
      return {
        success: false,
        error,
      };
    }
  }

  private updateIssue(issueDetails: IssueDetails, tx: PendingTx): IssueDetails {
    return {
      ...issueDetails,
      refreshStatus: RefreshStatus.SIGNED_BY_RKH,
      rkhPhase: {
        messageId: tx.id,
        approvals: tx.approved,
      },
    };
  }
}
