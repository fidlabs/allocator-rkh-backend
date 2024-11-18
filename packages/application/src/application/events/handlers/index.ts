import { IEventHandler } from '@filecoin-plus/core'
import { inject, injectable } from 'inversify'
import { Db } from 'mongodb'

import {
  AllocatorMultisigUpdated,
  ApplicationEdited,
  ApplicationPullRequestUpdated,
  DatacapAllocationUpdated,
  GovernanceReviewApproved,
  GovernanceReviewRejected,
  GovernanceReviewStarted,
  KYCApproved,
  KYCRejected,
  KYCStarted,
  RKHApprovalCompleted,
  RKHApprovalStarted,
  RKHApprovalsUpdated,
  MetaAllocatorApprovalStarted,
  MetaAllocatorApprovalCompleted,
  DatacapRefreshRequested,
} from '@src/domain/application/application.events'
import { TYPES } from '@src/types'
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository'
import { ApplicationStatus, ApplicationAllocator, ApplicationInstructionStatus, ApplicationInstruction } from '@src/domain/application/application'
import { ApplicationDetails } from '@src/infrastructure/respositories/application-details.types'

@injectable()
export class ApplicationEditedEventHandler implements IEventHandler<ApplicationEdited> {
  public event = ApplicationEdited.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) {}

  async handle(event: ApplicationEdited): Promise<void> {
    const updated = {
      id: event.aggregateId,
      number: event.applicationNumber,
      name: event.applicantName,
      organization: event.applicantOrgName,
      address: event.applicantAddress,
      github: event.applicantGithubHandle,
      location: event.applicantLocation,
      // xDONE
      applicationInstructions: event.applicationInstructions
      // applicationInstruction: {
      //   method: event.applicationInstructionMethod,
      //   amount: event.applicationInstructionAmount,
      // }
    } as Partial<ApplicationDetails>

    if (event.standardizedAllocations?.length) {
      updated.datacap = parseInt(event.standardizedAllocations[0])
    }

    await this._repository.update(updated)
  }
}

@injectable()
export class ApplicationPullRequestUpdatedEventHandler implements IEventHandler<ApplicationPullRequestUpdated> {
  public event = ApplicationPullRequestUpdated.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) {}

  async handle(event: ApplicationPullRequestUpdated): Promise<void> {
    await this._repository.update({
      id: event.aggregateId,
      status: event.status || ApplicationStatus.KYC_PHASE,
      applicationDetails: {
        pullRequestUrl: event.prUrl,
        pullRequestNumber: event.prNumber,
      },
    })
  }
}

@injectable()
export class AllocatorMultisigUpdatedEventHandler implements IEventHandler<AllocatorMultisigUpdated> {
  public event = AllocatorMultisigUpdated.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) {}

  async handle(event: AllocatorMultisigUpdated): Promise<void> {
    await this._repository.update({
      id: event.aggregateId,
      actorId: event.allocatorActorId,
      address: event.multisigAddress,
    })
  }
}
@injectable()
export class KYCStartedEventHandler implements IEventHandler<KYCStarted> {
  public event = KYCStarted.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: KYCStarted): Promise<void> {
    this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.KYC_PHASE,
    })
  }
}

@injectable()
export class KYCApprovedEventHandler implements IEventHandler<KYCApproved> {
  public event = KYCApproved.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: KYCApproved): Promise<void> {
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
    })
  }
}

@injectable()
export class KYCRejectedEventHandler implements IEventHandler<KYCRejected> {
  public event = KYCRejected.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: KYCRejected): Promise<void> {
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.REJECTED,
    })
  }
}

@injectable()
export class GovernanceReviewStartedEventHandler implements IEventHandler<GovernanceReviewStarted> {
  public event = GovernanceReviewStarted.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: GovernanceReviewStarted): Promise<void> {
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
    })
  }
}

@injectable()
export class GovernanceReviewApprovedEventHandler implements IEventHandler<GovernanceReviewApproved> {
  public event = GovernanceReviewApproved.name

  constructor(@inject(TYPES.Db) private readonly _db: Db) { }

  async handle(event: GovernanceReviewApproved): Promise<void> {
    const applicationInstructions = event.applicationInstructions
    const lastInstruction = applicationInstructions[applicationInstructions.length - 1]
    const lastInstructionMethod = lastInstruction.method

    const status = lastInstructionMethod === ApplicationAllocator.META_ALLOCATOR
      ? ApplicationStatus.META_APPROVAL_PHASE
      : ApplicationStatus.RKH_APPROVAL_PHASE

    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: status,
          applicationInstructions: applicationInstructions,
        },
      },
    )
  }
}

@injectable()
export class GovernanceReviewRejectedEventHandler implements IEventHandler<GovernanceReviewRejected> {
  public event = GovernanceReviewRejected.name

  constructor(@inject(TYPES.Db) private readonly _db: Db) { }

  async handle(event: GovernanceReviewRejected): Promise<void> {
    // Update allocator status in the database
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: ApplicationStatus.REJECTED,
          applicationInstructions: event.applicationInstructions,
        },
      },
    )
  }
}

@injectable()
export class MetaAllocatorApprovalStartedEventHandler implements IEventHandler<MetaAllocatorApprovalStarted> {
  public event = MetaAllocatorApprovalStarted.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) {}

  async handle(event: MetaAllocatorApprovalStarted): Promise<void> {
    console.log('MetaAllocatorApprovalStartedEventHandler', event)
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.META_APPROVAL_PHASE,
    })
  }

}

@injectable()
export class MetaAllocatorApprovalCompletedEventHandler implements IEventHandler<MetaAllocatorApprovalCompleted> {
  public event = MetaAllocatorApprovalCompleted.name

  constructor(@inject(TYPES.Db) private readonly _db: Db) { }

  async handle(event: MetaAllocatorApprovalCompleted) {
    console.log('MetaAllocatorApprovalCompletedEventHandler', event)
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: ApplicationStatus.APPROVED,
          applicationInstructions: event.applicationInstructions,
          metaAllocator: {
            blockNumber: event.blockNumber,
            txHash: event.txHash,
          },
        },
      },
    )
  }

}

@injectable()
export class RKHApprovalStartedEventHandler implements IEventHandler<RKHApprovalStarted> {
  public event = RKHApprovalStarted.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: RKHApprovalStarted): Promise<void> {
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.RKH_APPROVAL_PHASE,
      rkhPhase: {
        approvals: [],
        approvalThreshold: event.approvalThreshold,
      },
    })
  }
}

@injectable()
export class RKHApprovalsUpdatedEventHandler implements IEventHandler<RKHApprovalsUpdated> {
  public event = RKHApprovalsUpdated.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: RKHApprovalsUpdated) {
    console.log('RKHApprovalsUpdatedEventHandler', event)

    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.RKH_APPROVAL_PHASE,
      rkhPhase: {
        approvals: event.approvals,
        approvalThreshold: event.approvalThreshold,
        approvalMessageId: event.messageId,
      },
    })
  }
}

@injectable()
export class RKHApprovalCompletedEventHandler implements IEventHandler<RKHApprovalCompleted> {
  public event = RKHApprovalCompleted.name

  constructor(@inject(TYPES.Db) private readonly _db: Db) { }

  async handle(event: RKHApprovalCompleted) {
    // Update allocator status in the database
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: ApplicationStatus.APPROVED,
          applicationInstructions: event.applicationInstructions,
        },
      },
    )
  }
}

@injectable()
export class DatacapAllocationUpdatedEventHandler implements IEventHandler<DatacapAllocationUpdated> {
  public event = DatacapAllocationUpdated.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: DatacapAllocationUpdated) {
    console.log('DatacapAllocationUpdatedEventHandler', event)

    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.APPROVED,
      datacap: event.datacap,
    })
  }
}

@injectable()
export class DatacapRefreshRequestedEventHandler implements IEventHandler<DatacapRefreshRequested> {
  public event = DatacapRefreshRequested.name

  constructor(
    @inject(TYPES.ApplicationDetailsRepository) private readonly _repository: IApplicationDetailsRepository,
  ) { }

  async handle(event: DatacapRefreshRequested) {
    console.log('DatacapRefreshRequestedEventHandler', event)

    const currentDetails = await this._repository.getById(event.aggregateId)
    const updatedInstructions = [
      ...(currentDetails.applicationInstructions || []),
      {
        method: event.method,
        amount: event.amount,
        status: ApplicationInstructionStatus.PENDING,
        timestamp: event.timestamp.getTime(),
      }
    ]

    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
      applicationInstructions: updatedInstructions,
    })
  }
}
