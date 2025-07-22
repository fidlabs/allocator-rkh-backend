import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  ApproveRefreshByMaCommand,
  ApproveRefreshByMaCommandHandler,
} from './approve-refresh-by-ma.command';
import { IIssueDetailsRepository } from '@src/infrastructure/respositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { Approval } from '@src/infrastructure/clients/lotus';

describe('ApproveRefreshByMaCommand', () => {
  let container: Container;
  let handler: ApproveRefreshByMaCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { update: vi.fn() };

  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixtureApproval: Approval = {
    blockNumber: faker.number.int({ min: 1000, max: 9999 }),
    txHash: faker.string.alphanumeric(66),
    contractAddress: faker.string.alphanumeric(42),
    allocatorAddress: faker.string.alphanumeric(42),
    allowanceBefore: '1000000000000000', // 1 PiB in bytes
    allowanceAfter: '2000000000000000', // 2 PiB in bytes
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler).toSelf();

    handler = container.get<ApproveRefreshByMaCommandHandler>(ApproveRefreshByMaCommandHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully approve refresh by MetaAllocator', async () => {
    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    const expectedDataCap =
      parseFloat(fixtureApproval.allowanceAfter) - parseFloat(fixtureApproval.allowanceBefore);

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: fixtureApproval.txHash,
      blockNumber: fixtureApproval.blockNumber,
      metaAllocator: {
        blockNumber: fixtureApproval.blockNumber,
      },
      dataCap: expectedDataCap,
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should handle zero dataCap allocation', async () => {
    const approvalWithSameAllowance: Approval = {
      ...fixtureApproval,
      allowanceBefore: '1000000000000000',
      allowanceAfter: '1000000000000000', // Same as before = 0 difference
    };

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, approvalWithSameAllowance);
    await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: approvalWithSameAllowance.txHash,
      blockNumber: approvalWithSameAllowance.blockNumber,
      metaAllocator: {
        blockNumber: approvalWithSameAllowance.blockNumber,
      },
      dataCap: 0,
    });
  });

  it('should handle string numbers correctly in dataCap calculation', async () => {
    const approvalWithStringNumbers: Approval = {
      ...fixtureApproval,
      allowanceBefore: '1000000000000000.50',
      allowanceAfter: '2500000000000000.75',
    };

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, approvalWithStringNumbers);
    await handler.handle(command);

    const expectedDataCap = parseFloat('2500000000000000.75') - parseFloat('1000000000000000.50');

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: approvalWithStringNumbers.txHash,
      blockNumber: approvalWithStringNumbers.blockNumber,
      metaAllocator: {
        blockNumber: approvalWithStringNumbers.blockNumber,
      },
      dataCap: expectedDataCap,
    });
  });

  it('should handle error during repository update', async () => {
    const error = new Error('Failed to update repository');
    repositoryMock.update.mockRejectedValue(error);

    const command = new ApproveRefreshByMaCommand(fixtureIssueDetails, fixtureApproval);
    const result = await handler.handle(command);

    const expectedDataCap =
      parseFloat(fixtureApproval.allowanceAfter) - parseFloat(fixtureApproval.allowanceBefore);

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: fixtureApproval.txHash,
      blockNumber: fixtureApproval.blockNumber,
      metaAllocator: {
        blockNumber: fixtureApproval.blockNumber,
      },
      dataCap: expectedDataCap,
    });
    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });

  it('should preserve all original issue details properties', async () => {
    const issueWithManyProperties = {
      ...fixtureIssueDetails,
      customProperty: 'test',
      anotherProperty: 123,
    };

    const command = new ApproveRefreshByMaCommand(issueWithManyProperties, fixtureApproval);
    await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ...issueWithManyProperties,
        refreshStatus: 'DC_ALLOCATED',
        transactionCid: fixtureApproval.txHash,
        blockNumber: fixtureApproval.blockNumber,
        metaAllocator: {
          blockNumber: fixtureApproval.blockNumber,
        },
        dataCap: expect.any(Number),
      }),
    );
  });
});
