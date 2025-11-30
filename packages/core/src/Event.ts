import { IEvent } from './interfaces/IEvent';

export type EVENT_METADATA_TYPES = 'eventName' | 'aggregateName' | 'aggregateId' | 'version';

export const EVENT_METADATA = ['eventName', 'aggregateName', 'aggregateId', 'version'];

export type EventSource = 'github' | 'api';

export abstract class Event implements IEvent {
  public abstract eventName: string;
  public abstract aggregateName: string;
  public aggregateId: string;
  public version: number;
  public source: EventSource;

  constructor(aggregateId: string, source: EventSource = 'api') {
    this.aggregateId = aggregateId;
    this.source = source;
  }
}
