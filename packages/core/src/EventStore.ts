import { injectable, unmanaged } from 'inversify';
import { Collection } from 'mongodb';

import { ConcurrencyException, NotFoundException } from './Errors';
import { EventDescriptor } from './EventDescriptor';
import { IEvent } from './interfaces/IEvent';
import { IEventBus } from './interfaces/IEventBus';
import { IEventStore } from './interfaces/IEventStore';
import { createEventDescriptor, rehydrateEventFromDescriptor } from './utilities/EventProcessor';

@injectable()
export abstract class EventStore implements IEventStore {
  constructor(
    @unmanaged() private readonly eventCollection: Collection,
    @unmanaged() private readonly _eventBus: IEventBus,
  ) {}

  async saveEvents(
    aggregateGuid: string,
    events: IEvent[],
    expectedVersion: number,
  ): Promise<void> {
    const operations: any[] = [];

    const latestEvent = await this.getLastEventDescriptor(aggregateGuid);

    if (latestEvent && latestEvent.version !== expectedVersion && expectedVersion !== -1) {
      throw new ConcurrencyException('Cannot perform the operation due to internal conflict');
    }

    let i: number = expectedVersion;

    for (const event of events) {
      i++;
      event.version = i;
      const eventDescriptor = createEventDescriptor(event);
      operations.push({ insertOne: eventDescriptor });
    }

    await this.eventCollection.bulkWrite(operations);

    // Publish events to the message bus after saving to the collection
    for (const event of events) {
      const eventDescriptor = createEventDescriptor(event);
      this._eventBus.publish(event.aggregateName, eventDescriptor);
    }
  }

  async getEventsForAggregate(aggregateGuid: string): Promise<IEvent[]> {
    const events = await this.eventCollection
      .find({ aggregateGuid })
      .sort({ version: 1 })
      .toArray();
    if (!events.length) {
      throw new NotFoundException('Aggregate with the requested Guid does not exist');
    }

    // TODO: any: return events.map((eventDescriptor: EventDescriptor) => rehydrateEventFromDescriptor(eventDescriptor));
    return events.map((eventDescriptor: any) => rehydrateEventFromDescriptor(eventDescriptor));
  }

  private async getLastEventDescriptor(aggregateGuid: string) {
    const [latestEvent] = await this.eventCollection
      .find({ aggregateGuid }, { sort: { _id: -1 } })
      .toArray();
    return latestEvent;
  }
}
