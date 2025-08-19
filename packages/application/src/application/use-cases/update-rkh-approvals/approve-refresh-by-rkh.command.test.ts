import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import {
  ApproveRefreshByRKHCommand,
  ApproveRefreshByRKHCommandHandler,
} from './approve-refresh-by-rkh.command';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { ApprovedTx } from '@src/infrastructure/clients/lotus';

describe('ApproveRefreshByRKHCommand', () => {
  let container: Container;
  let handler: ApproveRefreshByRKHCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { update: vi.fn() };

  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixtureApprovedTx: ApprovedTx = {
    cid: faker.string.alphanumeric(46),
    to: '',
    from: '',
    timestamp: 0,
    params: '',
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<ApproveRefreshByRKHCommandHandler>(ApproveRefreshByRKHCommandHandler).toSelf();

    handler = container.get<ApproveRefreshByRKHCommandHandler>(ApproveRefreshByRKHCommandHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully approve refresh by RKH', async () => {
    const command = new ApproveRefreshByRKHCommand(fixtureIssueDetails, fixtureApprovedTx);
    const result = await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: fixtureApprovedTx.cid,
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should handle error during repository update', async () => {
    const error = new Error('Failed to update repository');
    repositoryMock.update.mockRejectedValue(error);

    const command = new ApproveRefreshByRKHCommand(fixtureIssueDetails, fixtureApprovedTx);
    const result = await handler.handle(command);

    expect(repositoryMock.update).toHaveBeenCalledWith({
      ...fixtureIssueDetails,
      refreshStatus: 'DC_ALLOCATED',
      transactionCid: fixtureApprovedTx.cid,
    });
    expect(loggerMock.error).toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error,
    });
  });
});
