import { TYPES } from '@src/types';
import { Container } from 'inversify';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { CreateApplicationCommand } from './create-application.command';
import { describe, it } from 'vitest';
import { subscribeApplicationSubmissions } from './subscribe-application-submissions.service';

const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn((...args) => console.log(...args)),
    error: vi.fn((...args) => console.error(...args)),
    debug: vi.fn((...args) => console.debug(...args)),
  },
  repository: {
    getById: vi.fn(),
    save: vi.fn(),
  },
  lotusClient: {
    getActorId: vi.fn(),
  },
  pullRequestService: {
    createPullRequest: vi.fn(),
  },
  airtableClient: {
    getTableRecords: vi.fn(),
  },
  commandBus: {
    send: vi.fn(),
  },
}));

vi.mock('@src/config', () => ({
  default: {
    SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL: 1000,
  },
}));

describe('subscribeApplicationSubmissions', () => {
  let container: Container;
  let interval: NodeJS.Timeout;

  beforeEach(async () => {
    container = new Container();
    container.bind(TYPES.Logger).toConstantValue(mocks.logger);
    container.bind(TYPES.DatacapAllocatorRepository).toConstantValue(mocks.repository);
    container.bind(TYPES.LotusClient).toConstantValue(mocks.lotusClient);
    container.bind(TYPES.PullRequestService).toConstantValue(mocks.pullRequestService);
    container.bind(TYPES.AirtableClient).toConstantValue(mocks.airtableClient);
    container.bind(TYPES.CommandBus).toConstantValue(mocks.commandBus);

    mocks.airtableClient.getTableRecords.mockResolvedValue([
      {
        id: '123',
        fields: {
          'Allocator Pathway Name': 'Test Applicant',
          'Organization Name': 'Test Org',
          'On-chain address for DC Allocation': 'f01234',
        },
      },
    ]);
    mocks.commandBus.send.mockResolvedValue({
      success: true,
      data: { guid: '123' },
    });

    vi.useFakeTimers();
    interval = await subscribeApplicationSubmissions(container);
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearInterval(interval);
    vi.useRealTimers();
  });

  it('should create an application', async () => {
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.airtableClient.getTableRecords).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).toHaveBeenCalledWith(expect.any(CreateApplicationCommand));
    expect(mocks.logger.info).toHaveBeenCalledWith('Record 123 processed successfully');
  });

  it('should not create an application if the record is not valid', async () => {
    mocks.airtableClient.getTableRecords.mockResolvedValue([
      {
        id: '123',
        fields: {
          'Allocator Pathway Name': 'Test Applicant',
          'Organization Name': 'Test Org',
        },
      },
    ]);

    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.airtableClient.getTableRecords).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).not.toHaveBeenCalled();
    expect(mocks.logger.info).toHaveBeenCalledWith('Skipping record 123...');
  });

  it('should not create an application if the record has already been processed', async () => {
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.airtableClient.getTableRecords).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).toHaveBeenCalledWith(expect.any(CreateApplicationCommand));
  });

  it('should handle command bus throw', async () => {
    mocks.commandBus.send.mockResolvedValue({
      success: false,
      error: new Error('Command bus error'),
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.airtableClient.getTableRecords).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).toHaveBeenCalledTimes(1);
    expect(mocks.commandBus.send).toHaveBeenCalledWith(expect.any(CreateApplicationCommand));
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Record 123 processed with error: Error: Command bus error',
    );
  });

  it('should handle airtable client throw', async () => {
    mocks.airtableClient.getTableRecords.mockRejectedValue(new Error('Airtable client error'));

    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.airtableClient.getTableRecords).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenCalledWith('Error processing application submissions:');
    expect(mocks.logger.error).toHaveBeenCalledWith(new Error('Airtable client error'));
  });
});
