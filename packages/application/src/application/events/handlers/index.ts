import { IEventHandler, Logger, zuluToEpoch } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { Db } from 'mongodb';
import { getMultisigInfo } from '@src/infrastructure/clients/filfox';

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
  KYCRevoked,
} from '@src/domain/application/application.events';
import { TYPES } from '@src/types';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import {
  ApplicationStatus,
  ApplicationAllocator,
  ApplicationInstructionStatus,
} from '@src/domain/application/application';
import { ApplicationDetails } from '@src/infrastructure/repositories/application-details.types';

@injectable()
export class ApplicationEditedEventHandler implements IEventHandler<ApplicationEdited> {
  public event = ApplicationEdited.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: ApplicationEdited): Promise<void> {
    this._logger.info('ApplicationEditedEventHandler started');
    this._logger.debug(event);
    // Convert human readable Zulu time to epoch for internal handling
    const lifeCycle = event.file.audits.map(ao => ({
      method:
        event.file.metapathway_type === 'MDMA'
          ? ApplicationAllocator.META_ALLOCATOR
          : ApplicationAllocator.RKH_ALLOCATOR,
      startTimestamp: zuluToEpoch(ao.started),
      endTimestamp: zuluToEpoch(ao.ended),
      allocatedTimestamp: zuluToEpoch(ao.dc_allocated),
      status: ao.outcome || 'PENDING',
      datacap_amount: ao.datacap_amount || 0,
    }));

    const updated = {
      id: event.aggregateId,
      number: event.file.application_number,
      name: event.file.name,
      organization: event.file.organization,
      address: event.file.address,
      github: event.file.application.github_handles[0],
      // xDONE
      applicationInstructions: lifeCycle,
    } as Partial<ApplicationDetails>;

    // FIXME here I think we need to find the most recent one based on dates, not just the length
    if (event.file.audits.length > 0) {
      const lastAudit = event.file.audits[event.file.audits.length - 1];
      updated.datacap = lastAudit.datacap_amount || 0;
    }

    await this._repository.update(updated);
  }
}

@injectable()
export class ApplicationPullRequestUpdatedEventHandler
  implements IEventHandler<ApplicationPullRequestUpdated>
{
  public event = ApplicationPullRequestUpdated.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: ApplicationPullRequestUpdated): Promise<void> {
    this._logger.info('ApplicationPullRequestUpdatedEventHandler started');
    this._logger.debug(event);
    await this._repository.update({
      id: event.aggregateId,
      status: event.status || ApplicationStatus.KYC_PHASE,
      applicationDetails: {
        pullRequestUrl: event.prUrl,
        pullRequestNumber: event.prNumber,
      },
    });
  }
}

@injectable()
export class AllocatorMultisigUpdatedEventHandler
  implements IEventHandler<AllocatorMultisigUpdated>
{
  public event = AllocatorMultisigUpdated.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: AllocatorMultisigUpdated): Promise<void> {
    this._logger.info('AllocatorMultisigUpdatedEventHandler started');
    this._logger.debug(event);
    let signers: string[] = [];
    let threshold = 0;
    try {
      const msigData = await getMultisigInfo(event.multisigAddress);
      signers = msigData.multisig?.signers ?? [];
      threshold = msigData.multisig?.approvalThreshold ?? 0;
    } catch (err) {
      console.error(`Failed to fetch multisig info for ${event.multisigAddress}:`, err);
    }

    await this._repository.update({
      id: event.aggregateId,
      actorId: event.allocatorActorId,
      address: event.multisigAddress,
      multisigDetails: {
        multisigThreshold: threshold,
        multisigSigners: signers,
      },
    });
  }
}
@injectable()
export class KYCStartedEventHandler implements IEventHandler<KYCStarted> {
  public event = KYCStarted.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: KYCStarted): Promise<void> {
    this._logger.info('KYCStartedEventHandler started');
    this._logger.debug(event);
    this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.KYC_PHASE,
    });
  }
}

@injectable()
export class KYCRevokedEventHandler implements IEventHandler<KYCRevoked> {
  public event = KYCRevoked.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: KYCRevoked): Promise<void> {
    this._logger.info('KYCRevokedEventHandler started');
    this._logger.debug(event);
    this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.KYC_PHASE,
    });
  }
}

@injectable()
export class KYCApprovedEventHandler implements IEventHandler<KYCApproved> {
  public event = KYCApproved.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: KYCApproved): Promise<void> {
    this._logger.info('KYCApprovedEventHandler started');
    this._logger.debug(event);
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
    });
  }
}

@injectable()
export class KYCRejectedEventHandler implements IEventHandler<KYCRejected> {
  public event = KYCRejected.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: KYCRejected): Promise<void> {
    this._logger.info('KYCRejectedEventHandler started');
    this._logger.debug(event);
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.REJECTED,
    });
  }
}

@injectable()
export class GovernanceReviewStartedEventHandler implements IEventHandler<GovernanceReviewStarted> {
  public event = GovernanceReviewStarted.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: GovernanceReviewStarted): Promise<void> {
    this._logger.info('GovernanceReviewStartedEventHandler started');
    this._logger.debug(event);
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
    });
  }
}

@injectable()
export class GovernanceReviewApprovedEventHandler
  implements IEventHandler<GovernanceReviewApproved>
{
  public event = GovernanceReviewApproved.name;

  constructor(
    @inject(TYPES.Db) private readonly _db: Db,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: GovernanceReviewApproved): Promise<void> {
    this._logger.info('GovernanceReviewApprovedEventHandler started');
    this._logger.debug(event);
    const applicationInstructions = event.applicationInstructions;
    const lastInstruction = applicationInstructions[applicationInstructions.length - 1];
    const lastInstructionMethod = lastInstruction.method;
    const lastInstructionAmount = lastInstruction.datacap_amount;

    const status =
      lastInstructionMethod === ApplicationAllocator.META_ALLOCATOR
        ? ApplicationStatus.META_APPROVAL_PHASE
        : ApplicationStatus.RKH_APPROVAL_PHASE;

    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: status,
          applicationInstructions: applicationInstructions,
          datacap: lastInstructionAmount,
        },
      },
    );
  }
}

@injectable()
export class GovernanceReviewRejectedEventHandler
  implements IEventHandler<GovernanceReviewRejected>
{
  public event = GovernanceReviewRejected.name;

  constructor(
    @inject(TYPES.Db) private readonly _db: Db,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: GovernanceReviewRejected): Promise<void> {
    this._logger.info('GovernanceReviewRejectedEventHandler started');
    this._logger.debug(event);
    // Update allocator status in the database
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          // FIXME need to harmonise the status enum with the new strings
          status: ApplicationStatus.REJECTED,
          applicationInstructions: event.applicationInstructions,
          // Hide the actorId for rejected applications
          actorId: 'f00000000',
        },
      },
    );
  }
}

@injectable()
export class MetaAllocatorApprovalStartedEventHandler
  implements IEventHandler<MetaAllocatorApprovalStarted>
{
  public event = MetaAllocatorApprovalStarted.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: MetaAllocatorApprovalStarted): Promise<void> {
    this._logger.info('MetaAllocatorApprovalStartedEventHandler started');
    this._logger.debug(event);
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.META_APPROVAL_PHASE,
    });
  }
}

@injectable()
export class MetaAllocatorApprovalCompletedEventHandler
  implements IEventHandler<MetaAllocatorApprovalCompleted>
{
  public event = MetaAllocatorApprovalCompleted.name;

  constructor(
    @inject(TYPES.Db) private readonly _db: Db,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: MetaAllocatorApprovalCompleted) {
    this._logger.info('MetaAllocatorApprovalCompletedEventHandler started');
    this._logger.debug(event);
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: ApplicationStatus.DC_ALLOCATED,
          applicationInstructions: event.applicationInstructions,
          metaAllocator: {
            blockNumber: event.blockNumber,
            txHash: event.txHash,
          },
        },
      },
    );
  }
}

@injectable()
export class RKHApprovalStartedEventHandler implements IEventHandler<RKHApprovalStarted> {
  public event = RKHApprovalStarted.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: RKHApprovalStarted): Promise<void> {
    this._logger.info('RKHApprovalStartedEventHandler started');
    this._logger.debug(event);
    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.RKH_APPROVAL_PHASE,
      rkhPhase: {
        approvals: [],
        approvalThreshold: event.approvalThreshold,
      },
    });
  }
}

@injectable()
export class RKHApprovalsUpdatedEventHandler implements IEventHandler<RKHApprovalsUpdated> {
  public event = RKHApprovalsUpdated.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: RKHApprovalsUpdated) {
    this._logger.info('RKHApprovalsUpdatedEventHandler started');
    this._logger.debug(event);

    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.RKH_APPROVAL_PHASE,
      rkhPhase: {
        approvals: event.approvals,
        approvalThreshold: event.approvalThreshold,
        approvalMessageId: event.messageId,
      },
    });
  }
}

@injectable()
export class RKHApprovalCompletedEventHandler implements IEventHandler<RKHApprovalCompleted> {
  public event = RKHApprovalCompleted.name;

  constructor(
    @inject(TYPES.Db) private readonly _db: Db,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: RKHApprovalCompleted) {
    this._logger.info('RKHApprovalCompletedEventHandler started');
    this._logger.debug(event);
    // Update allocator status in the database
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status: ApplicationStatus.DC_ALLOCATED,
          applicationInstructions: event.applicationInstructions,
        },
      },
    );
  }
}

@injectable()
export class DatacapAllocationUpdatedEventHandler
  implements IEventHandler<DatacapAllocationUpdated>
{
  public event = DatacapAllocationUpdated.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: DatacapAllocationUpdated) {
    this._logger.info('DatacapAllocationUpdatedEventHandler started');
    this._logger.debug(event);

    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.DC_ALLOCATED,
      datacap: event.datacap,
    });
  }
}

@injectable()
export class DatacapRefreshRequestedEventHandler implements IEventHandler<DatacapRefreshRequested> {
  public event = DatacapRefreshRequested.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Logger)
    private readonly _logger: Logger,
  ) {}

  async handle(event: DatacapRefreshRequested) {
    this._logger.info('DatacapRefreshRequestedEventHandler started');
    this._logger.debug(event);

    const currentDetails = await this._repository.getById(event.aggregateId);
    const updatedInstructions = [
      ...(currentDetails.applicationInstructions || []),
      {
        method: event.method,
        datacap_amount: event.amount,
        status: ApplicationInstructionStatus.PENDING,
        timestamp: event.timestamp.getTime(),
      },
    ];

    await this._repository.update({
      id: event.aggregateId,
      status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
      applicationInstructions: updatedInstructions,
    });
  }
}
