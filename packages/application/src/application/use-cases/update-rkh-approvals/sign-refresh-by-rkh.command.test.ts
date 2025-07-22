import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  SignRefreshByRKHCommand,
  SignRefreshByRKHCommandHandler,
} from './sign-refresh-by-rkh.command';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { PendingTx } from '@src/infrastructure/clients/lotus';
import cbor from 'cbor';

vi.mock('cbor', () => ({
  default: {
    decode: vi.fn(),
  },
}));

describe('SignRefreshByRKHCommand', () => {
  let container: Container;
  let handler: SignRefreshByRKHCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { update: vi.fn() };

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
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<SignRefreshByRKHCommandHandler>(SignRefreshByRKHCommandHandler).toSelf();

    handler = container.get<SignRefreshByRKHCommandHandler>(SignRefreshByRKHCommandHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully sign refresh by RKH', async () => {
    const mockDatacap = Buffer.from('1688849860263936'); // 1.5 PiB in hex
    (cbor.decode as any).mockReturnValue(['param1', mockDatacap]);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      dataCap: expect.any(Number),
      refreshStatus: 'SIGNED_BY_RKH',
      rkhPhase: {
        messageId: fixturePendingTx.id,
        approvals: fixturePendingTx.approved,
      },
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should handle error during repository update', async () => {
    (cbor.decode as any).mockReturnValue(['param1', Buffer.from('1125899906842624')]);

    const error = new Error('Failed to update repository');
    repositoryMock.update.mockRejectedValue(error);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    const result = await handler.handle(command);

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

    expect(repositoryMock.update).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });

  it('should set dataCap to 0 when params array is invalid', async () => {
    (cbor.decode as any).mockReturnValue(['only-one-param']);

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
    await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        dataCap: 0,
      }),
    );
  });

  it('should preserve rkhPhase data correctly', async () => {
    (cbor.decode as any).mockReturnValue(['param1', Buffer.from('1125899906842624')]);

    const customTx = {
      ...fixturePendingTx,
      id: 123456,
      approved: ['approval1', 'approval2'],
    };

    const command = new SignRefreshByRKHCommand(fixtureIssueDetails, customTx);
    await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rkhPhase: {
          messageId: 123456,
          approvals: ['approval1', 'approval2'],
        },
      }),
    );
  });

  describe('PiB conversion functionality', () => {
    const createHexBuffer = (bigintValue: bigint): Buffer => {
      const hex = bigintValue.toString(16);
      const paddedHex = hex.length % 2 === 1 ? '0' + hex : hex;
      return Buffer.from(paddedHex, 'hex');
    };

    it('should correctly convert 1 PiB exactly', async () => {
      // 1 PiB = 1125899906842624 bytes
      const onePiBBuffer = createHexBuffer(BigInt('1125899906842624'));
      (cbor.decode as any).mockReturnValue(['param1', onePiBBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 1,
        }),
      );
    });

    it('should correctly convert 1.5 PiB', async () => {
      // 1.5 PiB = 1688849860263936 bytes (precalculated)
      const oneHalfPiBBuffer = createHexBuffer(BigInt('1688849860263936'));
      (cbor.decode as any).mockReturnValue(['param1', oneHalfPiBBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 1.5,
        }),
      );
    });

    it('should correctly convert 0.5 PiB', async () => {
      // 0.5 PiB = 562949953421312 bytes (precalculated)
      const halfPiBBuffer = createHexBuffer(BigInt('562949953421312'));
      (cbor.decode as any).mockReturnValue(['param1', halfPiBBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 0.5,
        }),
      );
    });

    it('should correctly convert 2 PiB', async () => {
      // 2 PiB = 2251799813685248 bytes (precalculated)
      const twoPiBBuffer = createHexBuffer(BigInt('2251799813685248'));
      (cbor.decode as any).mockReturnValue(['param1', twoPiBBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 2,
        }),
      );
    });

    it('should correctly convert 16 PiB', async () => {
      // 16 PiB = 18014398509481984 bytes (precalculated)
      const sixteenPiBBuffer = createHexBuffer(BigInt('18014398509481984'));
      (cbor.decode as any).mockReturnValue(['param1', sixteenPiBBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 16,
        }),
      );
    });

    it('should correctly convert very large values (10000 PiB)', async () => {
      // 10000 PiB = 11258999068426240000 bytes (precalculated)
      const hugePiBBuffer = createHexBuffer(BigInt('11258999068426240000'));
      (cbor.decode as any).mockReturnValue(['param1', hugePiBBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 10000,
        }),
      );
    });

    it('should handle string datacap values', async () => {
      (cbor.decode as any).mockReturnValue(['param1', '1125899906842624']);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 1,
        }),
      );
    });

    it('should handle zero datacap', async () => {
      const zeroBuffer = Buffer.from('00', 'hex');
      (cbor.decode as any).mockReturnValue(['param1', zeroBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 0,
        }),
      );
    });

    it('should handle minimal non-zero datacap', async () => {
      const minimalBuffer = Buffer.from('01', 'hex'); // 1 byte
      (cbor.decode as any).mockReturnValue(['param1', minimalBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      const updateCall = repositoryMock.update.mock.calls[0][0];
      expect(updateCall.dataCap).toBeGreaterThan(0);
      expect(updateCall.dataCap).toBeLessThan(0.000001);
    });

    it('should handle fractional PiB with precision (1.25 PiB)', async () => {
      // 1.25 PiB = 1407374883553280 bytes (precalculated)
      const preciseValueBuffer = createHexBuffer(BigInt('1407374883553280'));
      (cbor.decode as any).mockReturnValue(['param1', preciseValueBuffer]);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      const updateCall = repositoryMock.update.mock.calls[0][0];
      expect(updateCall.dataCap).toBeCloseTo(1.25, 10);
    });
  });

  describe('CBOR parsing edge cases', () => {
    it('should handle non-array CBOR result', async () => {
      (cbor.decode as any).mockReturnValue({ not: 'an array' });

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 0,
        }),
      );
    });

    it('should handle null CBOR result', async () => {
      (cbor.decode as any).mockReturnValue(null);

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, fixturePendingTx);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 0,
        }),
      );
    });

    it('should handle empty params string', async () => {
      const txWithEmptyParams: PendingTx = {
        ...fixturePendingTx,
        params: '',
      };

      const command = new SignRefreshByRKHCommand(fixtureIssueDetails, txWithEmptyParams);
      await handler.handle(command);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dataCap: 0,
        }),
      );
    });
  });
});
