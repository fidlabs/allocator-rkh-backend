import { ICommandHandler } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import {
  ApplicationStatus,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { TYPES } from '@src/types';

import { RevokeKYCCommand } from '../../commands/common';

export class RevokeKycCommand extends RevokeKYCCommand {
  constructor(allocatorId: string) {
    super(allocatorId, ApplicationStatus.GOVERNANCE_REVIEW_PHASE);
  }
}

@injectable()
export class RevokeKYCCommandHandler implements ICommandHandler<RevokeKycCommand> {
  commandToHandle: string = RevokeKycCommand.name;

  constructor(
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly _repository: IDatacapAllocatorRepository,
  ) {
    console.log('commandToHandle', this.commandToHandle);
  }

  async handle(command: RevokeKycCommand): Promise<void> {
    const allocator = await this._repository.getById(command.allocatorId);
    if (!allocator) {
      throw new Error(`Allocator with id ${command.allocatorId} not found`);
    }

    allocator.revokeKYC();

    this._repository.save(allocator, -1);
  }
}
