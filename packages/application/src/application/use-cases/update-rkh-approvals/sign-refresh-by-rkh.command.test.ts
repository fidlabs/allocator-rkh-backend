import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  SignRefreshByRKHCommand,
  SignRefreshByRKHCommandHandler,
} from './sign-refresh-by-rkh.command';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { PendingTx } from '@src/infrastructure/clients/lotus';
import cbor from 'cbor';
import { CommandBus } from '@src/infrastructure/command-bus';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid'),
}));

describe('SignRefreshByRKHCommand', () => {
  let container: Container;
  let handler: SignRefreshByRKHCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };

  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixturePendingTx: PendingTx = {
    id: faker.number.int({ min: 1, max: 999999 }),
    to: faker.string.alphanumeric(40),
    method: faker.number.int({ min: 0, max: 10 }),
    params: 'base64encodedparams',
    value: '0',
    approved: [faker.string.alphanumeric(40)],
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<CommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as CommandBus);
    container.bind<SignRefreshByRKHCommandHandler>(SignRefreshByRKHCommandHandler).toSelf();

    handler = container.get<SignRefreshByRKHCommandHandler>(SignRefreshByRKHCommandHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully sign refresh by RKH', async () => {
    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'guid',
      issueDetails: {
        ...fixtureIssueDetails,
        refreshStatus: 'SIGNED_BY_RKH',
        rkhPhase: {
          messageId: fixturePendingTx.id,
          approvals: fixturePendingTx.approved,
        },
      },
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should handle error during repository update', async () => {
    const error = new Error('Failed to update repository');
    commandBusMock.send.mockRejectedValue(error);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
