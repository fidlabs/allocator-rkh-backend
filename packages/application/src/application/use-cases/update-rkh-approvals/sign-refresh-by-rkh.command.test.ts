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
import { IDataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';
import { CommandBus } from '@src/infrastructure/command-bus';

vi.mock('cbor', () => ({
  default: {
    decode: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid'),
}));

describe('SignRefreshByRKHCommand', () => {
  let container: Container;
  let handler: SignRefreshByRKHCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const dataCapMapperMock = { fromBufferBytesToPiBNumber: vi.fn() };
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
  const fixtureDataCap = 5;

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<CommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as CommandBus);
    container
      .bind<IDataCapMapper>(TYPES.DataCapMapper)
      .toConstantValue(dataCapMapperMock as unknown as IDataCapMapper);
    container.bind<SignRefreshByRKHCommandHandler>(SignRefreshByRKHCommandHandler).toSelf();

    handler = container.get<SignRefreshByRKHCommandHandler>(SignRefreshByRKHCommandHandler);

    dataCapMapperMock.fromBufferBytesToPiBNumber.mockReturnValue(fixtureDataCap);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully sign refresh by RKH', async () => {
    const mockDatacap = Buffer.from('1688849860263936'); // 1.5 PiB in hex
    (cbor.decode as any).mockReturnValue(['param1', mockDatacap]);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

    expect(dataCapMapperMock.fromBufferBytesToPiBNumber).toHaveBeenCalledWith(mockDatacap);
    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'guid',
      issueDetails: {
        ...fixtureIssueDetails,
        dataCap: fixtureDataCap,
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
    const mockDatacap = Buffer.from('1125899906842624');
    (cbor.decode as any).mockReturnValue(['param1', mockDatacap]);

    const error = new Error('Failed to update repository');
    commandBusMock.send.mockRejectedValue(error);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

    expect(dataCapMapperMock.fromBufferBytesToPiBNumber).toHaveBeenCalledWith(mockDatacap);
    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });

  it('should return error when CBOR fails with error', async () => {
    const error = new Error('Invalid CBOR');
    (cbor.decode as any).mockImplementation(() => {
      throw error;
    });

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

    expect(dataCapMapperMock.fromBufferBytesToPiBNumber).not.toHaveBeenCalled();
    expect(commandBusMock.send).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });

  it('should set dataCap to 0 when params array is invalid', async () => {
    (cbor.decode as any).mockReturnValue(['only-one-param']);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    await handler.handle(command);

    expect(dataCapMapperMock.fromBufferBytesToPiBNumber).not.toHaveBeenCalled();
    expect(commandBusMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        guid: 'guid',
        issueDetails: expect.objectContaining({
          dataCap: 0,
        }),
      }),
    );
  });

  describe('CBOR parsing edge cases', () => {
    it('should handle non-array CBOR result', async () => {
      (cbor.decode as any).mockReturnValue({ not: 'an array' });

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(commandBusMock.send).toHaveBeenCalledWith({
        guid: 'guid',
        issueDetails: expect.objectContaining({
          dataCap: 0,
        }),
      });
    });

    it('should handle null CBOR result', async () => {
      (cbor.decode as any).mockReturnValue(null);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(commandBusMock.send).toHaveBeenCalledWith({
        guid: 'guid',
        issueDetails: expect.objectContaining({
          dataCap: 0,
        }),
      });
    });

    it('should handle empty params string', async () => {
      const txWithEmptyParams: PendingTx = {
        ...fixturePendingTx,
        params: '',
      };

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, txWithEmptyParams);
      await handler.handle(command);

      expect(commandBusMock.send).toHaveBeenCalledWith({
        guid: 'guid',
        issueDetails: expect.objectContaining({
          dataCap: 0,
        }),
      });
    });
  });
});
