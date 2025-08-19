import { ICommandHandler } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import {
  ApplicationStatus,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { KYCApprovedData, KYCRejectedData } from '@src/domain/types';
import { TYPES } from '@src/types';

import { PhaseResult, PhaseStatus, SubmitPhaseResultCommand } from '../../commands/common';

export class SubmitKYCResultCommand extends SubmitPhaseResultCommand<
  KYCApprovedData,
  KYCRejectedData
> {
  constructor(allocatorId: string, result: PhaseResult<KYCApprovedData, KYCRejectedData>) {
    super(allocatorId, ApplicationStatus.KYC_PHASE, result);
  }
}

@injectable()
export class SubmitKYCResultCommandHandler implements ICommandHandler<SubmitKYCResultCommand> {
  commandToHandle: string = SubmitKYCResultCommand.name;

  constructor(
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly _repository: IDatacapAllocatorRepository,
  ) {}

  async handle(command: SubmitKYCResultCommand): Promise<void> {
    const allocator = await this._repository.getById(command.allocatorId);
    if (!allocator) {
      throw new Error(`Allocator with id ${command.allocatorId} not found`);
    }

    switch (command.result.status) {
      case PhaseStatus.Approved:
        allocator.approveKYC(command.result.data);
        break;
      case PhaseStatus.Rejected:
        allocator.rejectKYC(command.result.data);
        break;
      default:
        throw new Error('Invalid KYC result');
    }

    this._repository.save(allocator, -1);
  }
}
