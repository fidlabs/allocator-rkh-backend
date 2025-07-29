import { IEventBus, IEventStore, EventStore } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { Db } from 'mongodb';

import { DatacapAllocator } from '@src/domain/application/application';
import { TYPES } from '@src/types';

@injectable()
export class DatacapAllocatorEventStore
  extends EventStore
  implements IEventStore<DatacapAllocator>
{
  constructor(
    @inject(TYPES.Db) private readonly db: Db,
    @inject(TYPES.EventBus) private readonly eventBus: IEventBus,
  ) {
    super(db.collection('datacap-allocator-events'), eventBus);
  }
}
