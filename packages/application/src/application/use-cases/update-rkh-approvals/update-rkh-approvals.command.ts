import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { DatacapAllocator, IDatacapAllocatorRepository } from '@src/domain/application/application';
import { TYPES } from '@src/types';

export class UpdateRKHApprovalsCommand extends Command {
  constructor(
    public readonly allocatorId: string,
    public readonly messageId: number,
    public readonly approvals: string[],
    public readonly status: 'Pending' | 'Approved' | 'Rejected',
  ) {
    super();
  }
}

@injectable()
export class UpdateRKHApprovalsCommandHandler
  implements ICommandHandler<UpdateRKHApprovalsCommand>
{
  commandToHandle: string = UpdateRKHApprovalsCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly _repository: IDatacapAllocatorRepository,
  ) {}

  async handle(command: UpdateRKHApprovalsCommand): Promise<void> {
    this._logger.info('UpdateRKHApprovalsCommandHandler started');
    this._logger.debug(command);
    let allocator: DatacapAllocator;
    try {
      allocator = await this._repository.getById(command.allocatorId);
    } catch (error) {
      this._logger.error(error);
      return;
    }

    if (command.status === 'Pending') {
      allocator.updateRKHApprovals(command.messageId, command.approvals);
    } else if (command.status === 'Approved') {
      allocator.completeRKHApproval();
    }

    this._repository.save(allocator, -1);
  }
}
