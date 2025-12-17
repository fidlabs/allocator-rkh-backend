import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import {
  convertToActorId,
  handleMetaAllocatorIssueApproval,
  handleMetaAllocatorApplicationApproval,
} from './subscribe-ma-approvals.service';
import { ApproveRefreshByMaCommand } from './approve-refresh-by-ma.command';
import { UpdateMetaAllocatorApprovalsCommand } from './update-ma-approvals.command';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';
import { TYPES } from '@src/types';

const baseApproval = {
  blockNumber: 1234,
  txHash: '0xabc',
  contractAddress: '0xcontract',
  allocatorAddress: '0xallocator',
  allowanceBefore: '1',
  allowanceAfter: '2',
};

const defaultActorId = 'f01234';

vi.mock('@src/config', () => ({
  default: {
    MONGODB_URI: 'mongodb://localhost:27017',
    DB_NAME: 'test-db',
  },
}));

describe('subscribe-meta-allocator-approvals helpers', () => {
  let container: Container;
  let logger: Logger;
  let rpcProvider: IRpcProvider;
  let issuesRepository: IIssueDetailsRepository;
  let applicationDetailsRepository: IApplicationDetailsRepository;

  const loggerMock = {
    info: vi.fn((...args) => console.log(...args)),
    error: vi.fn((...args) => console.error(...args)),
    debug: vi.fn((...args) => console.debug(...args)),
  };
  const rpcProviderMock = {
    send: vi.fn(),
  };
  const issuesRepositoryMock = {
    findPendingBy: vi.fn(),
  };
  const applicationDetailsRepositoryMock = {
    getPendingBy: vi.fn(),
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IRpcProvider>(TYPES.RpcProvider)
      .toConstantValue(rpcProviderMock as unknown as IRpcProvider);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(issuesRepositoryMock as unknown as IIssueDetailsRepository);
    container
      .bind<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)
      .toConstantValue(
        applicationDetailsRepositoryMock as unknown as IApplicationDetailsRepository,
      );

    logger = container.get<Logger>(TYPES.Logger);
    rpcProvider = container.get<IRpcProvider>(TYPES.RpcProvider) as unknown as typeof rpcProvider;
    issuesRepository = container.get<IIssueDetailsRepository>(
      TYPES.IssueDetailsRepository,
    ) as unknown as typeof issuesRepository;
    applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
      TYPES.ApplicationDetailsRepository,
    ) as unknown as typeof applicationDetailsRepository;

    issuesRepositoryMock.findPendingBy.mockResolvedValue({
      id: 'issue-1',
      actorId: defaultActorId,
    });
    applicationDetailsRepositoryMock.getPendingBy.mockResolvedValue({
      id: 'app-1',
      actorId: defaultActorId,
    });
  });

  describe('convertToActorId', () => {
    it('returns the same allocatorAddress when it is already a Filecoin address', async () => {
      const allocatorAddress = 'f01234';

      const result = await convertToActorId({
        allocatorAddress,
        logger,
        rpcProvider: rpcProvider as unknown as IRpcProvider,
      });

      expect(result).toBe(allocatorAddress);
      expect(rpcProvider.send).not.toHaveBeenCalled();
    });

    it('converts an Ethereum address to a Filecoin actor id using rpc provider', async () => {
      const allocatorAddress = '0x1234';
      const expectedFilecoinId = 'f05678';
      rpcProviderMock.send.mockResolvedValue(expectedFilecoinId);

      const result = await convertToActorId({
        allocatorAddress,
        logger,
        rpcProvider: rpcProvider as unknown as IRpcProvider,
      });

      expect(rpcProvider.send).toHaveBeenCalledWith('Filecoin.EthAddressToFilecoinAddress', [
        allocatorAddress,
      ]);
      expect(result).toBe(expectedFilecoinId);
    });
  });

  describe('handleMetaAllocatorIssueApproval', () => {
    it('creates ApproveRefreshByMaCommand when issue exists', async () => {
      const command = await handleMetaAllocatorIssueApproval({
        approval: baseApproval as any,
        actorId: defaultActorId,
        issuesRepository: issuesRepository as unknown as IIssueDetailsRepository,
      });

      expect(issuesRepository.findPendingBy).toHaveBeenCalledWith({ actorId: defaultActorId });
      expect(command).toBeInstanceOf(ApproveRefreshByMaCommand);
    });

    it('throws when issue is not found', async () => {
      const actorId = 'f09999';
      issuesRepositoryMock.findPendingBy.mockResolvedValue(null);

      await expect(
        handleMetaAllocatorIssueApproval({
          approval: baseApproval as any,
          actorId,
          issuesRepository: issuesRepository as unknown as IIssueDetailsRepository,
        }),
      ).rejects.toThrowError(/Issue not found/);
    });
  });

  describe('handleMetaAllocatorApplicationApproval', () => {
    it('creates UpdateMetaAllocatorApprovalsCommand when application details exist', async () => {
      const actorId = defaultActorId;

      const command = await handleMetaAllocatorApplicationApproval({
        approval: baseApproval as any,
        actorId,
        applicationDetailsRepository:
          applicationDetailsRepository as unknown as IApplicationDetailsRepository,
      });

      expect(applicationDetailsRepository.getPendingBy).toHaveBeenCalledWith('actorId', actorId);
      expect(command).toBeInstanceOf(UpdateMetaAllocatorApprovalsCommand);
    });

    it('throws when application details are not found', async () => {
      const actorId = 'f09999';
      applicationDetailsRepositoryMock.getPendingBy.mockResolvedValue(null);

      await expect(
        handleMetaAllocatorApplicationApproval({
          approval: baseApproval as any,
          actorId,
          applicationDetailsRepository:
            applicationDetailsRepository as unknown as IApplicationDetailsRepository,
        }),
      ).rejects.toThrowError(/Application details not found/);
    });
  });
});
