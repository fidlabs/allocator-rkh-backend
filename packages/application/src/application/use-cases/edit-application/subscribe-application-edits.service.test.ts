import { describe, it, vi, afterEach, beforeEach, expect } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { subscribeApplicationEdits } from './subscribe-application-edits.service';
import { EditApplicationCommand } from './edit-application.command';

vi.mock('@src/config', () => ({
  default: {
    SUBSCRIBE_APPLICATION_EDITS_POLLING_INTERVAL: 1000,
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid-mock'),
}));

const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn((...args) => console.log(...args)),
    error: vi.fn((...args) => console.error(...args)),
  },
  githubClient: {
    getPullRequest: vi.fn(),
    getFile: vi.fn(),
  },
  commandBus: {
    send: vi.fn(),
  },
  applicationDetailsRepository: {
    getAll: vi.fn(),
  },
}));

describe('subscribeApplicationEdits', () => {
  let container: Container;
  let interval: NodeJS.Timeout;

  beforeEach(async () => {
    container = new Container();
    container.bind(TYPES.Logger).toConstantValue(mocks.logger);
    container.bind(TYPES.GithubClient).toConstantValue(mocks.githubClient);
    container.bind(TYPES.CommandBus).toConstantValue(mocks.commandBus);
    container
      .bind(TYPES.ApplicationDetailsRepository)
      .toConstantValue(mocks.applicationDetailsRepository);
    mocks.applicationDetailsRepository.getAll.mockResolvedValue([
      {
        id: '123',
        applicationDetails: {
          pullRequestUrl: 'https://github.com/test/repo/pull/123',
          pullRequestNumber: 123,
        },
      },
      {
        id: '456',
        applicationDetails: {
          pullRequestUrl: 'https://github.com/test/repo/pull/456',
          pullRequestNumber: 456,
        },
      },
    ]);
    mocks.githubClient.getPullRequest.mockResolvedValue({
      head: {
        ref: '123',
      },
    });
    mocks.githubClient.getFile
      .mockResolvedValueOnce({
        content: JSON.stringify({}),
        sha: '123',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({}),
        sha: '456',
      });
    mocks.commandBus.send.mockResolvedValue({
      success: true,
      data: { guid: '123' },
    });

    vi.useFakeTimers();
    interval = await subscribeApplicationEdits(container);
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearInterval(interval);
    vi.useRealTimers();
  });

  it('should send the edit application command for each application', async () => {
    await vi.advanceTimersByTimeAsync(1500);

    expect(mocks.applicationDetailsRepository.getAll).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(mocks.commandBus.send).toHaveBeenCalledTimes(2));

    expect(mocks.commandBus.send).toHaveBeenNthCalledWith(1, expect.any(EditApplicationCommand));
    expect(mocks.commandBus.send).toHaveBeenNthCalledWith(1, {
      applicationId: '123',
      file: {},
      guid: 'guid-mock',
      source: 'github',
    });
    expect(mocks.commandBus.send).toHaveBeenNthCalledWith(2, expect.any(EditApplicationCommand));
    expect(mocks.commandBus.send).toHaveBeenNthCalledWith(2, {
      applicationId: '456',
      file: {},
      guid: 'guid-mock',
      source: 'github',
    });
    expect(mocks.logger.info).toHaveBeenNthCalledWith(1, 'https://github.com/test/repo/pull/123');
    expect(mocks.logger.info).toHaveBeenNthCalledWith(2, 'Application 123 edited successfully');
    expect(mocks.logger.info).toHaveBeenNthCalledWith(3, 'https://github.com/test/repo/pull/456');
    expect(mocks.logger.info).toHaveBeenNthCalledWith(4, 'Application 456 edited successfully');
  });

  it('should log an error if the edit application command fails', async () => {
    vi.useFakeTimers();
    mocks.commandBus.send.mockResolvedValue({
      success: false,
      error: new Error('Test error'),
    });
    interval = await subscribeApplicationEdits(container);
    await vi.advanceTimersByTimeAsync(1500);
    vi.useRealTimers();

    expect(mocks.commandBus.send).toHaveBeenCalledTimes(2);
    expect(mocks.logger.error).toHaveBeenNthCalledWith(
      1,
      'Error editing application 123: Test error',
    );
    expect(mocks.logger.error).toHaveBeenNthCalledWith(
      2,
      'Error editing application 456: Test error',
    );
  });

  it('should log an error if the application details repository throws an error', async () => {
    mocks.applicationDetailsRepository.getAll.mockRejectedValue(new Error('Test error'));
    await vi.advanceTimersByTimeAsync(1500);

    expect(mocks.applicationDetailsRepository.getAll).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenNthCalledWith(
      1,
      'subscribeApplicationEdits uncaught exception',
    );
    expect(mocks.logger.error).toHaveBeenNthCalledWith(2, Error('Test error'));
    expect(mocks.commandBus.send).not.toHaveBeenCalled();
  });

  it('should log an error if the github client throws an error', async () => {
    mocks.githubClient.getPullRequest.mockRejectedValue(new Error('Test error'));
    await vi.advanceTimersByTimeAsync(1500);

    expect(mocks.githubClient.getPullRequest).toHaveBeenCalledTimes(2);
    expect(mocks.logger.error).toHaveBeenNthCalledWith(
      1,
      'Error processing application 123: Test error',
    );
    expect(mocks.logger.error).toHaveBeenNthCalledWith(
      2,
      'Error processing application 456: Test error',
    );
    expect(mocks.commandBus.send).not.toHaveBeenCalled();
  });

  it('should not update the application if the file sha is the same as the one in the cache', async () => {
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.githubClient.getFile).toHaveBeenCalledTimes(2);
    expect(mocks.commandBus.send).toHaveBeenCalledTimes(2);
    expect(mocks.logger.info).toHaveBeenNthCalledWith(1, 'https://github.com/test/repo/pull/123');
    expect(mocks.commandBus.send).toHaveBeenNthCalledWith(1, expect.any(EditApplicationCommand));
    expect(mocks.commandBus.send).toHaveBeenNthCalledWith(1, {
      applicationId: '123',
      file: {},
      guid: 'guid-mock',
      source: 'github',
    });
    expect(mocks.logger.info).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.githubClient.getFile).toHaveBeenCalledTimes(4);
    expect(mocks.logger.info).toHaveBeenNthCalledWith(5, 'https://github.com/test/repo/pull/123');
    expect(mocks.logger.info).toHaveBeenNthCalledWith(
      6,
      'file sha 123 for application 123 is the same as the one in the cache, skipping',
    );
    expect(mocks.logger.info).toHaveBeenNthCalledWith(7, 'https://github.com/test/repo/pull/456');
    expect(mocks.logger.info).toHaveBeenNthCalledWith(
      8,
      'file sha 456 for application 456 is the same as the one in the cache, skipping',
    );
    expect(mocks.commandBus.send).toHaveBeenCalledTimes(2);
  });
});
