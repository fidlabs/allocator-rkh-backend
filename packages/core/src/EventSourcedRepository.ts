import { injectable, unmanaged } from 'inversify';

import { AggregateRoot } from './AggregateRoot';
import { IEventStore } from './interfaces/IEventStore';
import { IRepository } from './interfaces/IRepository';

@injectable()
export class EventSourcedRepository<T extends AggregateRoot> implements IRepository<T> {
  constructor(
    @unmanaged() private readonly eventStore: IEventStore,
    @unmanaged() private readonly Type: { new (): T },
  ) {}

  async save(aggregateRoot: T, expectedVersion: number) {
    const uncommittedEvents = aggregateRoot.getUncommittedEvents();
    if (uncommittedEvents.length > 0) {
      await this.eventStore.saveEvents(aggregateRoot.guid, uncommittedEvents, expectedVersion);
      aggregateRoot.markChangesAsCommitted();
    }
  }

  async getById(guid: string) {
    const aggregateRoot = new this.Type() as T;
    const history = await this.eventStore.getEventsForAggregate(guid);
    aggregateRoot.loadFromHistory(history);
    return aggregateRoot;
  }
}
