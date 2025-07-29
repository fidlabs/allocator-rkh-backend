import {
  EventDescriptor,
  IEvent,
  IEventBus,
  IEventHandler,
  rehydrateEventFromDescriptor,
} from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { injectable, multiInject } from 'inversify';

/**
 * InMemoryEventBus
 *
 * A simple, in-memory implementation of IEventBus for testing purposes.
 * This class allows publishing events to in-memory channels and processing
 * them with registered event handlers.
 */
@injectable()
export class InMemoryEventBus implements IEventBus {
  private channels: Map<string, EventDescriptor[]>;

  constructor(@multiInject(TYPES.Event) private readonly eventHandlers: IEventHandler<IEvent>[]) {
    this.channels = new Map();
  }

  /**
   * Publishes an event to a specific channel.
   *
   * @param channel - The name of the channel to publish the event to.
   * @param eventDescriptor - The event descriptor to be published.
   */
  async publish(channel: string, eventDescriptor: EventDescriptor): Promise<void> {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, []);
    }
    this.channels.get(channel)!.push(eventDescriptor);

    // Process the event immediately
    await this.processEvent(eventDescriptor);
  }

  /**
   * Subscribes to events.
   * In this in-memory implementation, this method is a no-op as events
   * are processed immediately upon publishing.
   */
  async subscribeEvents(): Promise<void> {
    // No-op: Events are processed immediately in publish()
  }

  /**
   * Processes a single event by invoking all matching event handlers.
   *
   * @param eventDescriptor - The event descriptor to be processed.
   */
  private async processEvent(eventDescriptor: EventDescriptor): Promise<void> {
    const matchedHandlers: IEventHandler<IEvent>[] = this.eventHandlers.filter(
      handler => handler.event === eventDescriptor.eventName,
    );

    await Promise.all(
      matchedHandlers.map((handler: IEventHandler<IEvent>) => {
        return handler.handle(rehydrateEventFromDescriptor(eventDescriptor));
      }),
    );
  }

  /**
   * Retrieves all events published to a specific channel.
   * This method is useful for testing purposes to verify published events.
   *
   * @param channel - The name of the channel to retrieve events from.
   * @returns An array of EventDescriptors published to the specified channel.
   */
  getEventsForChannel(channel: string): EventDescriptor[] {
    return this.channels.get(channel) || [];
  }

  /**
   * Clears all published events from all channels.
   * This method is useful for resetting the state between tests.
   */
  clearAllEvents(): void {
    this.channels.clear();
  }
}
