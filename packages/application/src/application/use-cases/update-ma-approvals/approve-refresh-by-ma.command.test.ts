import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  ApproveRefreshByMaCommand,
  ApproveRefreshByMaCommandHandler,
} from './approve-refresh-by-ma.command';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { Approval } from '@src/infrastructure/clients/lotus';
import { IDataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';

describe('ApproveRefreshByMaCommand', () => {
  let container: Container;
  let handler: ApproveRefreshByMaCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { update: vi.fn() };
  const datacapMapperMock = { fromBigIntBytesToPiBNumber: vi.fn() };

  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixtureApproval: Approval = {
    blockNumber: faker.number.int({ min: 1000, max: 9999 }),
    txHash: faker.string.alphanumeric(66),
    contractAddress: faker.string.alphanumeric(42),
    allocatorAddress: faker.string.alphanumeric(42),
    allowanceBefore: '1125899906842624', // 1 PiB in bytes
    allowanceAfter: '2251799813685248', // 2 PiB in bytes
  };
  const fixtureMappedDatacap = 1;

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container
      .bind<IDataCapMapper>(TYPES.DataCapMapper)
      .toConstantValue(datacapMapperMock as unknown as IDataCapMapper);
    container.bind<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler).toSelf();

    handler = container.get<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler);

    datacapMapperMock.fromBigIntBytesToPiBNumber.mockReturnValue(fixtureMappedDatacap);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully approve refresh by MetaAllocator', async () => {
    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    expect(datacapMapperMock.fromBigIntBytesToPiBNumber).toHaveBeenCalledWith(
      BigInt('1125899906842624'),
    );
    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: fixtureApproval.txHash,
      blockNumber: fixtureApproval.blockNumber,
      metaAllocator: {
        blockNumber: fixtureApproval.blockNumber,
      },
      dataCap: fixtureMappedDatacap,
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should handle error during repository update', async () => {
    const error = new Error('Failed to update repository');
    repositoryMock.update.mockRejectedValue(error);

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    expect(datacapMapperMock.fromBigIntBytesToPiBNumber).toHaveBeenCalledWith(
      BigInt('1125899906842624'),
    );
    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: fixtureApproval.txHash,
      blockNumber: fixtureApproval.blockNumber,
      metaAllocator: {
        blockNumber: fixtureApproval.blockNumber,
      },
      dataCap: fixtureMappedDatacap,
    });
    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
