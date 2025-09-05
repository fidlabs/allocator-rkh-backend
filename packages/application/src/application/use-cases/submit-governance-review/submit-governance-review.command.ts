import { ICommandHandler } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import {
  ApplicationStatus,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { TYPES } from '@src/types';

import { PhaseResult, PhaseStatus, SubmitPhaseResultCommand } from '../../commands/common';
import { GovernanceReviewApprovedData, GovernanceReviewRejectedData } from '@src/domain/types';
import { AllocationPathResolver } from '@src/application/resolvers/allocation-path-resolver';

export class SubmitGovernanceReviewResultCommand extends SubmitPhaseResultCommand<
  GovernanceReviewApprovedData,
  GovernanceReviewRejectedData
> {
  constructor(
    allocatorId: string,
    result: PhaseResult<GovernanceReviewApprovedData, GovernanceReviewRejectedData>,
  ) {
    super(allocatorId, ApplicationStatus.GOVERNANCE_REVIEW_PHASE, result);
  }
}

@injectable()
export class SubmitGovernanceReviewResultCommandHandler
  implements ICommandHandler<SubmitGovernanceReviewResultCommand>
{
  commandToHandle: string = SubmitGovernanceReviewResultCommand.name;

  constructor(
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly _repository: IDatacapAllocatorRepository,
    @inject(TYPES.AllocationPathResolver)
    private readonly allocationPathResolver: AllocationPathResolver,
  ) {}

  async handle(command: SubmitGovernanceReviewResultCommand): Promise<void> {
    const allocator = await this._repository.getById(command.allocatorId);
    if (!allocator) {
      throw new Error(`Allocator with id ${command.allocatorId} not found`);
    }

    switch (command.result.status) {
      case PhaseStatus.Approved:
        allocator.approveGovernanceReview(
          command.result.data,
          this.allocationPathResolver.resolve(command.result.data.allocatorType),
        );
        break;
      case PhaseStatus.Rejected:
        allocator.rejectGovernanceReview(command.result.data);
        break;
      default:
        throw new Error('Invalid governance review result');
    }

    this._repository.save(allocator, -1);
  }
}
