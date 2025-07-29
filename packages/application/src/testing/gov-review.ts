import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';

import { TYPES } from '@src/types';
import { initialize } from '@src/startup';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import { createApplicationTest } from './create-app';
import {
  ApplicationStatus,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { IEventBus, Logger } from '@filecoin-plus/core';

async function main() {
  /*
    Governance review:

    phases: 
    - GOVERNANCE_REVIEW_PHASE => RKH_APPROVAL_PHASE | META_APPROVAL_PHASE => APPROVED
    - GOVERNANCE_REVIEW_PHASE is triggered after KYC is completed

    events:
    - GovernanceReviewApproved => status = RKH_APPROVAL_PHASE | META_APPROVAL_PHASE
    - MetaAllocatorApprovalStarted => status = META_APPROVAL_PHASE
    - RKHApprovalStarted => status = RKH_APPROVAL_PHASE
    - MetaAllocatorApprovalCompleted => status = APPROVED

    Test:
    1. Create a new application
    2. Update status to ApplicationStatus.GOVERNANCE_REVIEW_PHASE
    3. Call allocator.approveGovernanceReview()
    4. Check if status becomes RKH_APPROVAL_PHASE | META_APPROVAL_PHASE

    */

  let applicationId = 'app-test-1731240427';
  const testEdit = false;
  // TODO this test has rotted, no longer reflects updates to structures
  const applicationInstructions = [
    {
      method: 'RKH_ALLOCATOR',
      datacap_amount: 10,
      timestamp: 0,
    },
    {
      method: 'META_ALLOCATOR',
      datacap_amount: 20,
      timestamp: 1,
    },
  ];

  // let applicationId;
  const container = await initialize();
  const logger = container.get<Logger>(TYPES.Logger);

  // Initialize RabbitMQ as subscribe to events
  const eventBus = container.get<IEventBus>(TYPES.EventBus);
  try {
    // TODO: needed for RabbitMQ await eventBus.init();
    await eventBus.subscribeEvents();
    logger.info('Event bus initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize event bus ', { error });
    process.exit(1);
  }

  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  // const applications = await applicationDetailsRepository.getAll()
  // console.log("Applications: ", applications.length)

  if (!applicationId) {
    const timestamp = Math.floor(Date.now() / 1000);
    applicationId = `app-test-${timestamp}`;

    // 1. Create a new application
    await createApplicationTest(container, applicationId, false);
    let applicationDetails: any;
    while (true) {
      applicationDetails = await applicationDetailsRepository.getById(applicationId);
      if (applicationDetails) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('Finished creating new application with ID:', applicationDetails.applicationId);
  }

  console.log('Updating application with ID: ', applicationId);

  // 3. Update 'status' to ApplicationStatus.GOVERNANCE_REVIEW_PHASE
  const updated: any = {
    id: applicationId,
    status: ApplicationStatus.GOVERNANCE_REVIEW_PHASE,
  };
  if (!testEdit) {
    updated.applicationInstructions = applicationInstructions;
  }
  await applicationDetailsRepository.update(updated);

  let updatedApplicationDetails: any = await applicationDetailsRepository.getById(applicationId);
  console.log('Application instructions: ', updatedApplicationDetails.applicationInstructions);
  console.log(`Status of ${applicationId} updated to:`, updatedApplicationDetails.status);

  // 4. Call allocator.approveGovernanceReview()
  const allocatorRepository = container.get<IDatacapAllocatorRepository>(
    TYPES.DatacapAllocatorRepository,
  );
  const allocator = await allocatorRepository.getById(applicationId);

  if (!testEdit) {
    allocator.applicationInstructions = applicationInstructions;
  }
  allocator.applicationStatus = ApplicationStatus.GOVERNANCE_REVIEW_PHASE;

  allocator.approveGovernanceReview({
    finalDataCap: 10,
    allocatorType: 'Manual',
    reviewerAddress: '0x1234567890123456789012345678901234567890',
    isMDMAAllocator: false,
  });
  // .save will update the PR with the new status
  // .save also required for event handlers to trigger
  allocatorRepository.save(allocator, -1);
  await new Promise(resolve => setTimeout(resolve, 1000));

  updatedApplicationDetails = await applicationDetailsRepository.getById(applicationId);
  console.log(`Status of ${applicationId} updated to:`, updatedApplicationDetails.status);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
