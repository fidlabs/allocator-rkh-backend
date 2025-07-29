import { Command, ICommandHandler, Logger, NotFoundException } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { DatacapAllocator, IDatacapAllocatorRepository } from '@src/domain/application/application';
import { TYPES } from '@src/types';

export class UpdateDatacapAllocationCommand extends Command {
  constructor(
    public readonly allocatorId: string,
    public readonly datacap: number,
  ) {
    super();
  }
}

@injectable()
export class UpdateDatacapAllocationCommandHandler
  implements ICommandHandler<UpdateDatacapAllocationCommand>
{
  commandToHandle: string = UpdateDatacapAllocationCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly _repository: IDatacapAllocatorRepository,
  ) {}

  async handle(command: UpdateDatacapAllocationCommand): Promise<void> {
    this.logger.info(command);

    try {
      const allocator = await this._repository.getById(command.allocatorId);
      allocator.updateDatacapAllocation(command.datacap);
      this._repository.save(allocator, -1);
    } catch (error) {
      this.logger.error(`Error getting allocator ${command.allocatorId}`, error);
    }
  }
}
