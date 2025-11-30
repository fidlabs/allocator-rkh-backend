import { EventSourcedRepository, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';

import {
  DatacapAllocator,
  IDatacapAllocatorEventStore,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { PullRequestService } from '@src/application/services/pull-request.service';

@injectable()
export class DatacapAllocatorRepository
  extends EventSourcedRepository<DatacapAllocator>
  implements IDatacapAllocatorRepository
{
  constructor(
    @inject(TYPES.PullRequestService) private readonly pullRequestService: PullRequestService,
    @inject(TYPES.DatacapAllocatorEventStore)
    private readonly eventstore: IDatacapAllocatorEventStore,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {
    super(eventstore, DatacapAllocator);
  }

  async save(aggregateRoot: DatacapAllocator, expectedVersion: number) {
    if (aggregateRoot.hasPublishableEvents()) {
      try {
        await this.pullRequestService.updatePullRequest(aggregateRoot);
      } catch (error) {
        this.logger.error('error updating pull request');
        this.logger.error(error);
      }
    }
    return super.save(aggregateRoot, expectedVersion);
  }

  async getById(guid: string) {
    return super.getById(guid);
  }
}
