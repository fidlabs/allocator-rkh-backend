import { AggregateRoot, ApplicationError, IEventStore, IRepository } from '@filecoin-plus/core'
import { StatusCodes } from 'http-status-codes'

import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types'
import {
  GovernanceReviewApprovedData,
  GovernanceReviewRejectedData,
  KYCApprovedData,
  KYCRejectedData,
} from '@src/domain/types'
import {
  AllocatorMultisigUpdated,
  ApplicationCreated,
  ApplicationEdited,
  ApplicationPullRequestUpdated,
  DatacapAllocationUpdated,
  DatacapRefreshRequested,
  GovernanceReviewApproved,
  GovernanceReviewRejected,
  GovernanceReviewStarted,
  KYCApproved,
  KYCRejected,
  KYCRevoked,
  KYCStarted,
  MetaAllocatorApprovalCompleted,
  MetaAllocatorApprovalStarted,
  RKHApprovalCompleted,
  RKHApprovalStarted,
  RKHApprovalsUpdated,
} from './application.events'

import { epochToZulu, zuluToEpoch } from '@filecoin-plus/core'

export interface IDatacapAllocatorRepository extends IRepository<DatacapAllocator> {}

export interface IDatacapAllocatorEventStore extends IEventStore<DatacapAllocator> {}

export enum ApplicationStatus {
  KYC_PHASE = 'KYC_PHASE',
  GOVERNANCE_REVIEW_PHASE = 'GOVERNANCE_REVIEW_PHASE',
  RKH_APPROVAL_PHASE = 'RKH_APPROVAL_PHASE',
  META_APPROVAL_PHASE = 'META_APPROVAL_PHASE',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_REFRESH = 'IN_REFRESSH',
  DC_ALLOCATED = 'DC_ALLOCATED',
}

export enum ApplicationAllocator {
  META_ALLOCATOR = 'META_ALLOCATOR',
  RKH_ALLOCATOR = 'RKH_ALLOCATOR',
}

export type ApplicationPullRequest = {
  prNumber: number
  prUrl: string
  commentId: number
  timestamp: Date
}

export type ApplicationApplicantData = {
  name: string
  location: string
  githubHandle: string
  slackHandle: string
  address: string
  orgName: string
  orgAddress: string
}

export type ApplicationInstruction = {
  method: string
  datacap_amount: number
  startTimestamp?: number
  endTimestamp?: number
  allocatedTimestamp?: number
  status?: string
  isMDMAAllocator?: boolean
}

export enum ApplicationInstructionStatus {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  PENDING = 'PENDING',
}

export type ApplicationGrantCycle = {
  id: number
  status: ApplicationInstructionStatus
  pullRequest: ApplicationPullRequest
  instruction: ApplicationInstruction
}
export type StatusEvent = { stage: string; timestamp: number }


export class DatacapAllocator extends AggregateRoot {
  public applicationNumber: number
  public applicationPullRequest: ApplicationPullRequest

  public applicantName: string
  public applicantLocation: string
  public applicantGithubHandle: string
  public applicantSlackHandle: string
  public applicantAddress: string
  public applicantOrgName: string
  public applicantOrgAddresses: string
  public applicantOtherGithubHandles: string[]

  public allocationStandardizedAllocations: string[]
  public allocationAudit: string
  public allocationDistributionRequired: string
  public allocationTargetClients: string[]
  public allocationTrancheSchedule: string
  public allocationRequiredReplicas: string
  public allocationRequiredStorageProviders: string
  public allocationTooling: string[]
  public allocationDataTypes: string[]
  public allocationProjected12MonthsUsage: string
  public allocationBookkeepingRepo: string
  public allocationMaxDcClient: string
  public applicationInstructions: ApplicationInstruction[] = []

  public applicationStatus: ApplicationStatus

  public type: string
  public datacap: number
  public datacapAmount: number
  public refresh?: boolean
  public pathway?: string
  public ma_address?: string

  public rkhApprovalThreshold: number = 2
  public rkhApprovals: string[] = []

  public allocatorActorId?: string
  public allocatorMultisigAddress?: string
  public allocatorMultisigThreshold?: number
  public allocatorMultisigSigners?: string[]

  public grantCycles: ApplicationGrantCycle[] = []

  public allocationDatacapAllocationLimits: string
  public onChainAddressForDataCapAllocation: string

  public mdma_address = 'f410fw325e6novwl57jcsbhz6koljylxuhqq5jnp5ftq'
  public rkh_address = 'f080'
  public isMetaAllocator: boolean
  public isMDMA: boolean | undefined

  public status: { [key: string]: number | null } = {
    'Application Submitted': null,
    'KYC Submitted': null,
    Approved: null,
    Declined: null,
    'DC Allocated': null,
  }
 
  constructor(guid?: string) {
    super(guid)
  }

  get grantCycle(): number {
    return this.grantCycles.length
  }

  static create(params: {
    applicationId: string
    applicationNumber: number
    applicantName: string
    applicantAddress: string
    applicantOrgName: string
    applicantOrgAddresses: string
    allocationTrancheSchedule: string
    allocationAudit: string
    allocationDistributionRequired: string
    allocationRequiredStorageProviders: string
    bookkeepingRepo: string
    allocationRequiredReplicas: string
    datacapAllocationLimits: string
    applicantGithubHandle: string
    otherGithubHandles: string[]
    onChainAddressForDataCapAllocation: string
  }): DatacapAllocator {
    const allocator = new DatacapAllocator(params.applicationId)
    allocator.applyChange(
      new ApplicationCreated(
        allocator.guid,
        params.applicationNumber,
        params.applicantName,
        params.applicantAddress,
        params.applicantOrgName,
        params.applicantOrgAddresses,
        params.allocationAudit,
        params.allocationDistributionRequired,
        params.allocationRequiredStorageProviders,
        params.allocationRequiredReplicas,
        params.datacapAllocationLimits,
        params.applicantGithubHandle,
        params.otherGithubHandles ?? [],
        params.onChainAddressForDataCapAllocation,
        params.bookkeepingRepo,
        params.allocationTrancheSchedule,
      ),
    )
    return allocator
  }

  edit(file: ApplicationPullRequestFile) {
    //this.ensureValidApplicationStatus([ApplicationStatus.KYC_PHASE, ApplicationStatus.GOVERNANCE_REVIEW_PHASE])
    console.log('edit')
    this.applyChange(new ApplicationEdited(this.guid, file))
  }

  setAllocatorMultisig(
    allocatorActorId: string,
    multisigAddress: string,
    multisigThreshold: number,
    multisigSigners: string[],
  ) {
    this.ensureValidApplicationStatus([ApplicationStatus.KYC_PHASE])

    this.applyChange(
      new AllocatorMultisigUpdated(this.guid, allocatorActorId, multisigAddress, multisigThreshold, multisigSigners),
    )
  }

  setApplicationPullRequest(
    pullRequestNumber: number,
    pullRequestUrl: string,
    commentId: number,
    refresh: boolean = false,
  ) {
    console.log('setApplicationPullRequest', this.applicationStatus)
    if (!refresh) {
      this.ensureValidApplicationStatus([ApplicationStatus.KYC_PHASE])
      this.applyChange(
        new ApplicationPullRequestUpdated(
          this.guid,
          pullRequestNumber,
          pullRequestUrl,
          commentId,
          ApplicationStatus.KYC_PHASE,
        ),
      )
    } else {
      this.ensureValidApplicationStatus([ApplicationStatus.DC_ALLOCATED])
      this.applyChange(
        new ApplicationPullRequestUpdated(
          this.guid,
          pullRequestNumber,
          pullRequestUrl,
          commentId,
          ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
        ),
      )
    }
  }

  approveKYC(data: KYCApprovedData) {
    console.log('approveKYC')
    this.ensureValidApplicationStatus([ApplicationStatus.KYC_PHASE])

    this.applyChange(new KYCApproved(this.guid, data))
    this.applyChange(new GovernanceReviewStarted(this.guid))
  }

  revokeKYC() {
    this.ensureValidApplicationStatus([ApplicationStatus.GOVERNANCE_REVIEW_PHASE])

    this.applyChange(new KYCRevoked(this.guid))
  }

  rejectKYC(data: KYCRejectedData) {
    this.ensureValidApplicationStatus([ApplicationStatus.KYC_PHASE])

    this.applyChange(new KYCRejected(this.guid, data))
  }

  approveGovernanceReview(details: GovernanceReviewApprovedData) {
    console.log('approveGovernanceReview')
    this.ensureValidApplicationStatus([ApplicationStatus.GOVERNANCE_REVIEW_PHASE])

    /*
      The choice of type means that:
        in Automated and Market Based cases:
          the application should advance to RKH approval
        in Manual:
          pathway field updated to MDMA
          the address changed to MDMA address from env variable
          the tooling field should get "smart_contract_allocator" entry
          the application should advance to MDMA approval
    */
    const approvedMethod =
      details?.allocatorType === 'Manual' ? ApplicationAllocator.META_ALLOCATOR : ApplicationAllocator.RKH_ALLOCATOR
    const lastInstructionIndex = this.applicationInstructions.length - 1
    this.applicationInstructions[lastInstructionIndex].method = approvedMethod
    this.applicationInstructions[lastInstructionIndex].datacap_amount = details?.finalDataCap
    this.applicationInstructions[lastInstructionIndex].status = ApplicationInstructionStatus.PENDING
    this.applicationInstructions[lastInstructionIndex].isMDMAAllocator = details?.isMDMAAllocator

    //this.applicationInstructions[lastInstructionIndex].timestamp = Math.floor(Date.now() / 1000)

    this.applyChange(new GovernanceReviewApproved(this.guid, this.applicationInstructions))

    this.isMetaAllocator = this.applicationInstructions[lastInstructionIndex].method === ApplicationAllocator.META_ALLOCATOR
    this.isMDMA = details?.isMDMAAllocator

    const action = () => {
      if (this.isMetaAllocator && this.isMDMA){
        this.allocationTooling = ['smart_contract_allocator']
        this.pathway = 'MDMA'
        this.ma_address = this.mdma_address
        this.applicationStatus = ApplicationStatus.DC_ALLOCATED
        this.applicationInstructions[lastInstructionIndex].status = ApplicationInstructionStatus.GRANTED
        console.log('apply gov review MDMA', this)
        return new MetaAllocatorApprovalCompleted(this.guid, 0, '', this.applicationInstructions)
      }
      if (this.isMetaAllocator && !this.isMDMA) return new MetaAllocatorApprovalStarted(this.guid)
      if (!this.isMetaAllocator && this.isMDMA){
        this.allocationTooling = []
        this.pathway = 'RKH'
        this.ma_address = this.rkh_address
        this.applicationStatus = ApplicationStatus.DC_ALLOCATED
        this.applicationInstructions[lastInstructionIndex].status = ApplicationInstructionStatus.GRANTED
        console.log('apply gov review RKH', this)
        return new RKHApprovalCompleted(this.guid, this.applicationInstructions)
      }
      return new RKHApprovalStarted(this.guid, 2) // TODO: Hardcoded 2 for multisig threshold
    }

    this.applyChange(action())
    console.log('apply gov review none', this)
  }

  rejectGovernanceReview(details: GovernanceReviewRejectedData) {
    this.ensureValidApplicationStatus([ApplicationStatus.GOVERNANCE_REVIEW_PHASE])

    const lastInstructionIndex = this.applicationInstructions.length - 1
    this.applicationInstructions[lastInstructionIndex].status = ApplicationInstructionStatus.DENIED
    this.applyChange(new GovernanceReviewRejected(this.guid, this.applicationInstructions))
  }

  updateRKHApprovals(messageId: number, approvals: string[]) {
    this.ensureValidApplicationStatus([ApplicationStatus.RKH_APPROVAL_PHASE])

    if (approvals.length !== this.rkhApprovals.length) {
      this.applyChange(new RKHApprovalsUpdated(this.guid, messageId, approvals, this.rkhApprovalThreshold))
    }
  }

  async completeMetaAllocatorApproval(blockNumber: number, txHash: string) {
    console.log('completeMetaAllocatorApproval...')
    /* Big hack warning (AKA "TODO")
     * All throughout the various steps of the code it's really good at updating the Mongo, so
     * things like changes in DataCap allowance are properly reflected in the JSON and the PR and
     * the UI. But this in-memory object is not very well maintained.
     * Specifically for the application instructions the in-memory object is not updated with the
     * latest status as the application progresses, so when we check it here it's still the default.
     * 
     * HOWEVER, I believe it's not actually necessary to check this here, because the on-chain
     * messages and the PR are all correct already, so I'm disabling this check for now.
     * If all holds up then we can decide whether to simply remove this code or go ahead with
     * the refactoring to maintain the object properly.
     */

    //this.ensureValidApplicationInstructions([
    //  ApplicationAllocator.META_ALLOCATOR,
    //  ApplicationAllocator.RKH_ALLOCATOR,
    //])
    //const lastInstructionIndex = this.applicationInstructions.length - 1
    //this.applicationInstructions[lastInstructionIndex].status = ApplicationInstructionStatus.GRANTED
    this.applyChange(new MetaAllocatorApprovalCompleted(this.guid, blockNumber, txHash, this.applicationInstructions))
  }

  completeRKHApproval() {
    console.log("Completing RKH Approval for application", this)
    this.ensureValidApplicationStatus([ApplicationStatus.RKH_APPROVAL_PHASE])

    /* Big hack warning (AKA "TODO")
     * All throughout the various steps of the code it's really good at updating the Mongo, so
     * things like changes in DataCap allowance are properly reflected in the JSON and the PR and
     * the UI. But this in-memory object is not very well maintained.
     * Specifically for the application instructions the in-memory object is not updated with the
     * latest status as the application progresses, so when we check it here it's still the default.
     * 
     * HOWEVER, I believe it's not actually necessary to check this here, because the on-chain
     * messages and the PR are all correct already, so I'm disabling this check for now.
     * If all holds up then we can decide whether to simply remove this code or go ahead with
     * the refactoring to maintain the object properly.
     */

    //this.ensureValidApplicationInstructions([
    //  ApplicationAllocator.META_ALLOCATOR,
    //  ApplicationAllocator.RKH_ALLOCATOR,
    //])
    const lastInstructionIndex = this.applicationInstructions.length - 1
    this.applicationInstructions[lastInstructionIndex].status = ApplicationInstructionStatus.GRANTED
    this.applyChange(new RKHApprovalCompleted(this.guid, this.applicationInstructions))
  }

  updateDatacapAllocation(datacap: number) {
    console.log('updateDatacapAllocation')
    try {
      this.completeRKHApproval()
    } catch (error) {}
    // TODO: this.applyChange(new DatacapAllocationUpdated(this.guid, datacap));
  }

  requestDatacapRefresh() {
    this.ensureValidApplicationStatus([ApplicationStatus.DC_ALLOCATED])

    this.applicationStatus = ApplicationStatus.IN_REFRESH

    const prevInstruction = this.applicationInstructions[this.applicationInstructions.length - 1]
    const refreshAmount = prevInstruction.datacap_amount * 2
    const refreshMethod = prevInstruction.method

    this.applyChange(new DatacapRefreshRequested(this.guid, refreshAmount, refreshMethod))
  }
  applyApplicationCreated(event: ApplicationCreated) {
    //console.log('applyApplicationCreated', event)
    this.guid = event.guid

    this.applicationNumber = event.applicationNumber
    this.applicantName = event.applicantName
    this.applicantAddress = event.applicantAddress
    this.applicantOrgName = event.applicantOrgName
    this.applicantOrgAddresses = event.applicantOrgAddresses
    this.applicantGithubHandle = event.applicantGithubHandle
    this.allocationBookkeepingRepo = event.bookkeepingRepo
    this.allocationTrancheSchedule = event.allocationTrancheSchedule
    this.allocationAudit = event.audit
    this.allocationDistributionRequired = event.distributionRequired
    this.allocationRequiredStorageProviders = event.allocationRequiredStorageProviders
    this.allocationRequiredReplicas = event.allocationRequiredReplicas
    this.allocationDatacapAllocationLimits = event.datacapAllocationLimits
    this.onChainAddressForDataCapAllocation = event.onChainAddressForDataCapAllocation
    if(!this.applicationStatus){
      this.applicationStatus = ApplicationStatus.KYC_PHASE;

      this.applicationInstructions = [
      {
        method: '',
        datacap_amount: 5,
        // FIXME do we want to set the timestamp here, or only start the clock when Gov Team review starts?
        startTimestamp: event.timestamp.getTime(),
        status: ApplicationInstructionStatus.PENDING,
      },
    ]
    }
    console.log(`Application Created Ended`, this)
  }

  applyApplicationEdited(event: ApplicationEdited) {
    //console.log(`Application Edited Started`, event)
    this.applicantAddress = event.file.address || this.applicantAddress
    this.applicantName = event.file.name || this.applicantName

    this.applicantOrgName = event.file.organization || this.applicantOrgName

    if (this.applicationStatus === ApplicationStatus.META_APPROVAL_PHASE || (this.isMetaAllocator&&this.isMDMA)) {
      this.allocationTooling = ['smart_contract_allocator']
      this.pathway = 'MDMA'
      this.ma_address = this.mdma_address
    }
    if (this.applicationStatus === ApplicationStatus.RKH_APPROVAL_PHASE || (!this.isMetaAllocator && this.isMDMA)) {
      this.allocationTooling = []
      this.pathway = 'RKH'
      this.ma_address = this.rkh_address
    }

    this.applicantOrgAddresses = event.file.associated_org_addresses || this.applicantOrgAddresses
    this.allocationStandardizedAllocations =
      event.file.application.allocations || this.allocationStandardizedAllocations
    this.allocationAudit =
      event.file.application.audit && event.file.application.audit.length > 0
        ? event.file.application.audit[0]
        : this.allocationAudit
    this.allocationDistributionRequired =
      event.file.application.distribution && event.file.application.distribution.length > 0
        ? event.file.application.distribution[0]
        : this.allocationDistributionRequired
    this.allocationTrancheSchedule = event.file.application.tranche_schedule || this.allocationTrancheSchedule
    this.allocationRequiredReplicas = event.file.application.required_replicas || this.allocationRequiredReplicas
    this.allocationRequiredStorageProviders =
      event.file.application.required_sps || this.allocationRequiredStorageProviders
    this.allocationMaxDcClient = event.file.application.max_DC_client || this.allocationMaxDcClient
    this.applicantGithubHandle =
      event.file.application.github_handles && event.file.application.github_handles.length > 0
        ? event.file.application.github_handles[0]
        : this.applicantGithubHandle
    this.onChainAddressForDataCapAllocation =
      event.file.application.client_contract_address || this.onChainAddressForDataCapAllocation
    this.allocationBookkeepingRepo = event.file.application.allocation_bookkeeping || this.allocationBookkeepingRepo
    this.allocatorMultisigAddress = event.file.pathway_addresses?.msig || this.allocatorMultisigAddress
    this.allocatorMultisigSigners = event.file.pathway_addresses?.signers || this.allocatorMultisigSigners

    this.applicationInstructions = event.file.audits.map((ao) => ({
      method: event.file.metapathway_type === "MDMA" ? ApplicationAllocator.META_ALLOCATOR : ApplicationAllocator.RKH_ALLOCATOR,
      startTimestamp: zuluToEpoch(ao.started),
      endTimestamp: zuluToEpoch(ao.ended),
      allocatedTimestamp: zuluToEpoch(ao.dc_allocated),
      status: ao.outcome || "PENDING",
      datacap_amount: ao.datacap_amount || 0
    }))
    console.log(`Application Edited Ended`, this)
  }

  applyAllocatorMultisigUpdated(event: AllocatorMultisigUpdated) {
    console.log('applyAllocatorMultisigUpdated')
    this.allocatorActorId = event.allocatorActorId
    this.allocatorMultisigAddress = event.multisigAddress
    this.allocatorMultisigThreshold = event.multisigThreshold
    this.allocatorMultisigSigners = event.multisigSigners
  }

  applyApplicationPullRequestUpdated(event: ApplicationPullRequestUpdated) {
    console.log('applyApplicationPullRequestUpdated')

    this.applicationPullRequest = {
      prNumber: event.prNumber,
      prUrl: event.prUrl,
      commentId: event.commentId,
      timestamp: event.timestamp,
    }
    if (this.status['Application Submitted'] === null) {
      this.status['Application Submitted'] = event.timestamp.getTime()
    }
  }

  applyKYCStarted(_: KYCStarted) {
    console.log(' applyKYCStarted')
    this.applicationStatus = ApplicationStatus.KYC_PHASE
  }

  applyKYCApproved(event: KYCApproved) {
    console.log(' applyKYCApproved')
    if (this.applicationStatus === ApplicationStatus.KYC_PHASE) {
      this.status['KYC Submitted'] ??= event.timestamp.getTime()
      this.applicationStatus = ApplicationStatus.GOVERNANCE_REVIEW_PHASE
    }
  }
  //check that it should be KYCApproved.
  applyKYCRevoked(_: KYCApproved) {
    this.applicationStatus = ApplicationStatus.GOVERNANCE_REVIEW_PHASE
    this.status['KYC Submitted'] = null
  }

  applyKYCRejected(event: KYCRejected) {
    this.status['KYC Failed'] = event.timestamp.getTime()
  }

  applyGovernanceReviewStarted(event: GovernanceReviewStarted) {
    console.log('applyGovernanceReviewStarted')
    if (this.applicationStatus === ApplicationStatus.IN_REFRESH) {
      this.status['In Refresh'] ??= event.timestamp.getTime()
      this.applicationStatus = ApplicationStatus.GOVERNANCE_REVIEW_PHASE
    }
  }

  applyGovernanceReviewApproved(event: GovernanceReviewApproved) {
    console.log('applyGovernanceReviewApproved')
    if (this.applicationStatus === ApplicationStatus.GOVERNANCE_REVIEW_PHASE) {
      this.status['Approved'] ??= event.timestamp.getTime()
    }
    //this.applicationStatus = ApplicationStatus.APPROVED
    this.applicationInstructions = event.applicationInstructions
  }

  applyGovernanceReviewRejected(event: GovernanceReviewRejected) {
    this.applicationStatus = ApplicationStatus.REJECTED
    if (!this.status['Declined']) {
      this.status['Declined'] = event.timestamp.getTime()
    }
  }

  applyRKHApprovalStarted(event: RKHApprovalStarted) {
    console.log('applyRKHApprovalStarted')
    this.applicationStatus = ApplicationStatus.RKH_APPROVAL_PHASE
    this.allocationTooling = []
    this.pathway = 'RKH'
    this.ma_address = this.rkh_address
    this.rkhApprovalThreshold = event.approvalThreshold
  }

  applyRKHApprovalsUpdated(event: RKHApprovalsUpdated) {
    console.log(' applyRKHApprovalsUpdated')
    this.applicationStatus =
      event.approvals.length < event.approvalThreshold
        ? ApplicationStatus.RKH_APPROVAL_PHASE
        : ApplicationStatus.DC_ALLOCATED

    this.rkhApprovals = event.approvals
    this.rkhApprovalThreshold = event.approvalThreshold
  }

  applyRKHApprovalCompleted(event: RKHApprovalCompleted) {
    this.ensureValidApplicationStatus([ApplicationStatus.GOVERNANCE_REVIEW_PHASE,ApplicationStatus.RKH_APPROVAL_PHASE, ApplicationStatus.DC_ALLOCATED])
    this.status['DC Allocated'] ??= event.timestamp.getTime()
    this.applicationStatus = ApplicationStatus.DC_ALLOCATED
    this.allocationTooling = []
    this.pathway = 'RKH'
    this.ma_address = this.rkh_address
    const index = this.applicationInstructions.length - 1
    this.applicationInstructions[index].allocatedTimestamp = event.timestamp.getTime()
    this.applicationInstructions[index].status = ApplicationInstructionStatus.GRANTED
    this.applicationInstructions[index].datacap_amount = event.applicationInstructions[index].datacap_amount
  }

  applyMetaAllocatorApprovalStarted(event: MetaAllocatorApprovalStarted) {
    this.applicationStatus = ApplicationStatus.META_APPROVAL_PHASE
    this.allocationTooling = ['smart_contract_allocator']
    this.pathway = 'MDMA'
    this.ma_address = this.mdma_address
  }

  applyMetaAllocatorApprovalCompleted(event: MetaAllocatorApprovalCompleted) {
    this.ensureValidApplicationStatus([ApplicationStatus.GOVERNANCE_REVIEW_PHASE,ApplicationStatus.META_APPROVAL_PHASE, ApplicationStatus.DC_ALLOCATED])
    this.status['DC Allocated'] ??= event.timestamp.getTime()
    this.applicationStatus = ApplicationStatus.DC_ALLOCATED
  
    this.allocationTooling = ['smart_contract_allocator']
    this.pathway = 'MDMA'
    this.ma_address = this.mdma_address
    const index = this.applicationInstructions.length - 1
    this.applicationInstructions[index].allocatedTimestamp = event.timestamp.getTime()
    this.applicationInstructions[index].status = ApplicationInstructionStatus.GRANTED
    this.applicationInstructions[index].datacap_amount = event.applicationInstructions[index].datacap_amount
  }

  applyDatacapAllocationUpdated(event: DatacapAllocationUpdated) {
    this.applicationStatus = ApplicationStatus.DC_ALLOCATED
    this.datacapAmount = event.datacap
  }

  applyDatacapRefreshRequested(event: DatacapRefreshRequested) {
    console.log('applyDatacapRefreshRequested', this.applicationStatus)
    if (this.applicationStatus === ApplicationStatus.DC_ALLOCATED) {
      this.status['In Refresh'] ??= event.timestamp.getTime()
    }
    this.applicationStatus = ApplicationStatus.GOVERNANCE_REVIEW_PHASE
    this.applicationInstructions.push({
      method: event.method,
      datacap_amount: event.amount,
      // FIXME do we want to set the timestamp here, or only start the clock when Gov Team review starts?
      startTimestamp: event.timestamp.getTime(),
      status: ApplicationInstructionStatus.PENDING,
    })
    console.log('applyDatacapRefreshRequested', this.applicationInstructions)
  }

  private ensureValidApplicationStatus(
    expectedStatuses: ApplicationStatus[],
    errorCode: string = '5308',
    errorMessage: string = 'Invalid operation for the current phase',
  ): void {
    if (!expectedStatuses.includes(this.applicationStatus)) {
      console.error(`Invalid application status: ${this.applicationStatus}. Expected one of: ${expectedStatuses.join(', ')}`)
      throw new ApplicationError(StatusCodes.BAD_REQUEST, errorCode, errorMessage)
    }
  }

  private ensureValidApplicationInstructions(
    expectedInstructionMethods: ApplicationAllocator[],
    errorCode: string = '5308',
    errorMessage: string = 'Invalid application instructions for the current phase',
  ): void {
    if (this.applicationInstructions.length === 0) {
      throw new ApplicationError(StatusCodes.BAD_REQUEST, errorCode, 'Empty instruction data')
    }

    const lastInstruction = this.applicationInstructions[this.applicationInstructions.length - 1]
    let instructionMethod: string
    let instructionAmount: number
    try {
      instructionMethod = lastInstruction.method
      instructionAmount = lastInstruction.datacap_amount
    } catch (error) {
      throw new ApplicationError(StatusCodes.BAD_REQUEST, errorCode, 'Latest instruction data is invalid')
    }

    if (!expectedInstructionMethods.includes(instructionMethod as ApplicationAllocator)) {
      throw new ApplicationError(StatusCodes.BAD_REQUEST, errorCode, errorMessage)
    }
  }
}
