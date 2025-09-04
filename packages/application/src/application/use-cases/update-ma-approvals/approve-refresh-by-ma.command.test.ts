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
import { CommandBus } from '@src/infrastructure/command-bus';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';

describe('ApproveRefreshByMaCommand', () => {
  let container: Container;
  let handler: ApproveRefreshByMaCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const datacapMapperMock = { fromBigIntBytesToPiBNumber: vi.fn() };
  const refreshAuditServiceMock = { approveAudit: vi.fn() };
  const auditResult = {
    auditChange: {
      started: '2024-01-01T00:00:00.000Z',
      ended: '2024-01-01T00:00:00.000Z',
      dcAllocated: '2024-01-01T00:00:00.000Z',
      outcome: 'MATCH',
    },
    branchName: 'b',
    commitSha: 'c',
    prNumber: 1,
    prUrl: 'u',
  };
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
      .bind<CommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as CommandBus);
    container
      .bind<IDataCapMapper>(TYPES.DataCapMapper)
      .toConstantValue(datacapMapperMock as unknown as IDataCapMapper);
    container
      .bind<RefreshAuditService>(TYPES.RefreshAuditService)
      .toConstantValue(refreshAuditServiceMock as unknown as RefreshAuditService);
    container.bind<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler).toSelf();

    handler = container.get<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler);

    datacapMapperMock.fromBigIntBytesToPiBNumber.mockReturnValue(fixtureMappedDatacap);
    refreshAuditServiceMock.approveAudit.mockResolvedValue(auditResult);
    commandBusMock.send.mockResolvedValue({ success: true });
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
    expect(refreshAuditServiceMock.approveAudit).toHaveBeenCalledWith(
      fixtureIssueDetails.jsonNumber,
    );
    expect(commandBusMock.send).toHaveBeenCalledWith({
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
    commandBusMock.send.mockRejectedValue(error);

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    expect(datacapMapperMock.fromBigIntBytesToPiBNumber).toHaveBeenCalledWith(
      BigInt('1125899906842624'),
    );
    expect(refreshAuditServiceMock.approveAudit).toHaveBeenCalledWith(
      fixtureIssueDetails.jsonNumber,
    );
    expect(commandBusMock.send).toHaveBeenCalledWith({
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
