import {
  EventDescriptor,
  IEvent,
  IEventBus,
  IEventHandler,
  rehydrateEventFromDescriptor,
} from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { classToPlain } from 'class-transformer';
import { inject, injectable, multiInject } from 'inversify';
import * as amqp from 'amqplib';

/**
 * Configuration options for RabbitMQEventBus
 */
export interface RabbitMQConfig {
  url: string;
  username?: string;
  password?: string;
  exchangeName: string;
  exchangeType: string;
  queueName: string;
}

/**
 * Implements IEventBus using RabbitMQ as the message broker.
 */
@injectable()
export class RabbitMQEventBus implements IEventBus {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    @multiInject(TYPES.Event)
    private readonly eventHandlers: IEventHandler<IEvent>[],
    @inject(TYPES.RabbitMQConfig) private readonly config: RabbitMQConfig,
  ) {}

  /**
   * Initializes the RabbitMQ connection and channel.
   * @throws Error if connection fails
   */
  public async init(): Promise<void> {
    try {
      const connUrl = this.buildConnectionUrl();
      this.connection = await amqp.connect(connUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.config.exchangeName, this.config.exchangeType, {
        durable: true,
      });
    } catch (error) {
      console.error('Failed to initialize RabbitMQ connection:', error);
      throw error;
    }
  }

  /**
   * Publishes an event to the specified channel.
   * @param channel - The channel (routing key) to publish the event to
   * @param eventDescriptor - The event descriptor to be published
   * @throws Error if channel is not initialized
   */
  public async publish(channel: string, eventDescriptor: EventDescriptor): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized. Call init() first.');
    }

    const payload: string = JSON.stringify(classToPlain(eventDescriptor));
    this.channel.publish(this.config.exchangeName, channel, Buffer.from(payload), {
      persistent: true,
      messageId: eventDescriptor.aggregateGuid,
    });
  }

  /**
   * Subscribes to events and processes them using registered event handlers.
   * @throws Error if channel is not initialized
   */
  public async subscribeEvents(): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized. Call init() first.');
    }

    const { queue } = await this.channel.assertQueue(this.config.queueName, {
      durable: true,
    });
    await this.channel.bindQueue(queue, this.config.exchangeName, this.config.queueName);

    await this.channel.consume(queue, async msg => {
      if (msg) {
        try {
          await this.processMessage(msg);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          // Implement your error handling strategy here (e.g., dead-letter queue)
          this.channel!.nack(msg, false, false);
        }
      }
    });
  }

  /**
   * Closes the RabbitMQ connection and channel.
   */
  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  /**
   * Processes a single message, invoking appropriate event handlers.
   * @param msg - The RabbitMQ message to process
   */
  private async processMessage(msg: amqp.ConsumeMessage): Promise<void> {
    const eventDescriptor = JSON.parse(msg.content.toString());
    console.log('Processing message:', eventDescriptor);
    const matchedHandlers: IEventHandler<IEvent>[] = this.eventHandlers.filter(
      handler => handler.event === eventDescriptor.eventName,
    );

    await Promise.all(
      matchedHandlers.map((handler: IEventHandler<IEvent>) =>
        handler.handle(rehydrateEventFromDescriptor(eventDescriptor)),
      ),
    );
  }

  private buildConnectionUrl(): string {
    const { url, username, password } = this.config;
    if (!username || !password) {
      return `amqp://${url}`;
    }
    return `amqp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${url}`;
  }
}
