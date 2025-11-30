import { IEvent } from './IEvent';

export interface IEventStore<T = any> {
  saveEvents(aggregateGuid: string, eventHistory: IEvent[], version: number): Promise<void>;
  getEventsForAggregate(aggregateGuid: string): Promise<IEvent[]>;
}
