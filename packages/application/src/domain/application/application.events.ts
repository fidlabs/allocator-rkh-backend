import { Event } from '@filecoin-plus/core'
import { KYCApprovedData, KYCRejectedData } from '@src/domain/types'
import { ApplicationInstruction, ApplicationStatus } from './application'

export class ApplicationCreated extends Event {
  eventName = ApplicationCreated.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    public guid: string,
    public applicationNumber: number,
    public applicantName: string,
    public applicantAddress: string,
    public applicantOrgName: string,
    public applicantOrgAddresses: string[],
    public allocationTrancheScheduleType: string,
    public audit: string,
    public distributionRequired: string,
    public allocationRequiredStorageProviders: string,
    public allocationRequiredReplicas: string,
    public datacapAllocationLimits: string,
    public applicantGithubHandle: string,
    public otherGithubHandles: string[],
    public onChainAddressForDataCapAllocation: string,
  ) {
    super(guid)
    this.timestamp = new Date()
  }
}

export class ApplicationEdited extends Event {
  eventName = ApplicationEdited.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public applicationNumber?: number,
    public applicantName?: string,
    public applicantLocation?: string,
    public applicantGithubHandle?: string,
    public applicantSlackHandle?: string,
    public applicantAddress?: string,
    public applicantOrgName?: string,
    public applicantOrgAddresses?: string[],
    public standardizedAllocations?: string[],
    public targetClients?: string[],
    public requiredReplicas?: string,
    public requiredStorageProviders?: string,
    public tooling?: string[],
    public dataTypes?: string[],
    public projected12MonthsUsage?: string,
    public allocationBookkeepingRepo?: string,
    public applicationInstructions?: ApplicationInstruction[],
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class AllocatorMultisigUpdated extends Event {
  eventName = AllocatorMultisigUpdated.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    applicationId: string,
    public allocatorActorId: string,
    public multisigAddress: string,
    public multisigThreshold: number,
    public multisigSigners: string[],
  ) {
    super(applicationId)
    this.timestamp = new Date()
  }
}

export class ApplicationPullRequestUpdated extends Event {
  eventName = ApplicationPullRequestUpdated.name
  aggregateName = 'allocator'

  public timestamp: Date
  public status?: ApplicationStatus

  constructor(
    allocatorId: string,
    public prNumber: number,
    public prUrl: string,
    public commentId: number,
    status?: ApplicationStatus,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
    this.status = status
  }
}

export class KYCStarted extends Event {
  eventName = KYCStarted.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(allocatorId: string) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class KYCApproved extends Event {
  eventName = KYCApproved.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public data: KYCApprovedData,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class KYCRejected extends Event {
  eventName = KYCRejected.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public data: KYCRejectedData,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class GovernanceReviewStarted extends Event {
  eventName = GovernanceReviewStarted.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(allocatorId: string) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class GovernanceReviewApproved extends Event {
  eventName = GovernanceReviewApproved.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public applicationInstructions: ApplicationInstruction[],
  ) {
    super(allocatorId)
  }
}

export class GovernanceReviewRejected extends Event {
  eventName = GovernanceReviewRejected.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public applicationInstructions: ApplicationInstruction[],
  ) {
    super(allocatorId)
  }
}

export class RKHApprovalStarted extends Event {
  eventName = RKHApprovalStarted.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    // TODO: public readonly multisigAddress: string,
    public readonly approvalThreshold: number,
    // TODO: public readonly signers: string[]
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class MetaAllocatorApprovalStarted extends Event {
  eventName = MetaAllocatorApprovalStarted.name
  aggregateName = 'allocator'
  
  public timestamp: Date

  constructor(
    allocatorId: string,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class MetaAllocatorApprovalCompleted extends Event {
  eventName = MetaAllocatorApprovalCompleted.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public blockNumber: number,
    public txHash: string,
    public applicationInstructions: ApplicationInstruction[],
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}


export class RKHApprovalsUpdated extends Event {
  eventName = RKHApprovalsUpdated.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public messageId: number,
    public approvals: string[],
    public approvalThreshold: number,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class RKHApprovalCompleted extends Event {
  eventName = RKHApprovalCompleted.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public applicationInstructions: ApplicationInstruction[],
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class DatacapAllocationUpdated extends Event {
  eventName = DatacapAllocationUpdated.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public datacap: number,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}

export class DatacapRefreshRequested extends Event {
  eventName = DatacapRefreshRequested.name
  aggregateName = 'allocator'

  public timestamp: Date

  constructor(
    allocatorId: string,
    public amount: number,
    public method: string,
  ) {
    super(allocatorId)
    this.timestamp = new Date()
  }
}
