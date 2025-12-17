import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  ApproveRefreshByMaCommand,
  ApproveRefreshByMaCommandHandler,
} from './approve-refresh-by-ma.command';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { Approval } from '@src/infrastructure/clients/lotus';
import { CommandBus } from '@src/infrastructure/command-bus';
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { SaveIssueCommand } from '../refresh-issues/save-issue.command';
import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';
import { DataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid'),
}));

describe('ApproveRefreshByMaCommand', () => {
  let container: Container;
  let handler: ApproveRefreshByMaCommandHandler;
  const fixtureDatacapAmount = 1;

  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const refreshAuditServiceMock = { finishAudit: vi.fn() };
  const dataCapMapperMock = {
    fromBigIntBytesToPiBNumber: vi.fn().mockReturnValue(fixtureDatacapAmount),
  };
  const rpcProviderMock = {
    getDcAllocatedDate: vi.fn(),
    getBlock: vi.fn(),
  };

  const fixtureAuditResult = {
    auditChange: {
      started: '2024-01-01T00:00:00.000Z',
      ended: '2024-01-01T00:00:00.000Z',
      dcAllocated: '2024-01-01T00:00:00.000Z',
      outcome: 'MATCH',
      datacapAmount: fixtureDatacapAmount,
    },
    branchName: 'b',
    commitSha: 'c',
    prNumber: 1,
    prUrl: 'u',
  };
  const fixtureIssueDetails = DatabaseRefreshFactory.create({ dataCap: 0 });
  const fixtureApproval: Approval = {
    blockNumber: faker.number.int({ min: 1000, max: 9999 }),
    txHash: faker.string.alphanumeric(66),
    contractAddress: faker.string.alphanumeric(42),
    allocatorAddress: faker.string.alphanumeric(42),
    allowanceBefore: '1125899906842624',
    allowanceAfter: '2251799813685248',
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<CommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as CommandBus);
    container
      .bind<IRpcProvider>(TYPES.RpcProvider)
      .toConstantValue(rpcProviderMock as unknown as IRpcProvider);
    container
      .bind<DataCapMapper>(TYPES.DataCapMapper)
      .toConstantValue(dataCapMapperMock as unknown as DataCapMapper);
    container
      .bind<RefreshAuditService>(TYPES.RefreshAuditService)
      .toConstantValue(refreshAuditServiceMock as unknown as RefreshAuditService);
    container.bind<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler).toSelf();

    handler = container.get<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler);

    dataCapMapperMock.fromBigIntBytesToPiBNumber.mockReturnValue(1);
    rpcProviderMock.getBlock.mockResolvedValue({
      timestamp: new Date('2020-01-01T00:00:00.000Z').getTime() / 1000,
    });
    refreshAuditServiceMock.finishAudit.mockResolvedValue(fixtureAuditResult);
    commandBusMock.send.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully approve refresh by MetaAllocator', async () => {
    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    expect(refreshAuditServiceMock.finishAudit).toHaveBeenCalledWith(
      fixtureIssueDetails.jsonNumber,
      {
        newDatacapAmount: 1,
        dcAllocatedDate: '2020-01-01T00:00:00.000Z',
      },
    );
    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'guid',
      issueDetails: {
        ...fixtureIssueDetails,
        refreshStatus: RefreshStatus.DC_ALLOCATED,
        transactionCid: fixtureApproval.txHash,
        blockNumber: fixtureApproval.blockNumber,
        auditHistory: [fixtureAuditResult],
        metaAllocator: {
          blockNumber: fixtureApproval.blockNumber,
        },
        dataCap: fixtureDatacapAmount,
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

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    expect(refreshAuditServiceMock.finishAudit).toHaveBeenCalledWith(
      fixtureIssueDetails.jsonNumber,
      {
        newDatacapAmount: 1,
        dcAllocatedDate: '2020-01-01T00:00:00.000Z',
      },
    );
    expect(commandBusMock.send).toHaveBeenCalledWith({
      guid: 'guid',
      issueDetails: {
        ...fixtureIssueDetails,
        refreshStatus: RefreshStatus.DC_ALLOCATED,
        transactionCid: fixtureApproval.txHash,
        blockNumber: fixtureApproval.blockNumber,
        auditHistory: [fixtureAuditResult],
        metaAllocator: {
          blockNumber: fixtureApproval.blockNumber,
        },
        dataCap: fixtureDatacapAmount,
      },
    });
    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(SaveIssueCommand));
    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });

  it('should handle error during rpc provider call', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
    const now = new Date().toISOString();

    const error = new Error('Failed to get block');
    rpcProviderMock.getBlock.mockRejectedValue(error);

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    expect(refreshAuditServiceMock.finishAudit).toHaveBeenCalledWith(
      fixtureIssueDetails.jsonNumber,
      {
        newDatacapAmount: 1,
        dcAllocatedDate: now,
      },
    );
    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: true,
    });
  });
});
