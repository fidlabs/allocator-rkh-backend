import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { Logger } from '@filecoin-plus/core';
import { IDatacapAllocatorRepository } from '@src/domain/application/application';
import {
  SubmitGovernanceReviewResultCommand,
  SubmitGovernanceReviewResultCommandHandler,
} from './submit-governance-review.command';
import { PhaseStatus } from '../../commands/common';
import { AllocatorType, GovernanceReviewApprovedData } from '@src/domain/types';
import { AllocationPathResolver } from '@src/application/resolvers/allocation-path-resolver';
import { DatacapAllocator } from '@src/domain/application/application';

describe('SubmitGovernanceReviewResultCommandHandler', () => {
  let container: Container;
  let handler: SubmitGovernanceReviewResultCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() } as unknown as Logger;
  const repositoryMock = { getById: vi.fn(), save: vi.fn() };
  const allocationPathResolverMock = { resolve: vi.fn() };

  const fixtureResolvedPath = {
    isMetaAllocator: true,
    pathway: 'MDMA',
    address: 'f0123',
    auditType: 'Enterprise',
  };

  const fixtureAllocator = {
    approveGovernanceReview: vi.fn(),
    rejectGovernanceReview: vi.fn(),
  } as unknown as DatacapAllocator;

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock);
    container
      .bind<IDatacapAllocatorRepository>(TYPES.DatacapAllocatorRepository)
      .toConstantValue(repositoryMock as unknown as IDatacapAllocatorRepository);
    container
      .bind<AllocationPathResolver>(TYPES.AllocationPathResolver)
      .toConstantValue(allocationPathResolverMock as unknown as AllocationPathResolver);
    container
      .bind<SubmitGovernanceReviewResultCommandHandler>(SubmitGovernanceReviewResultCommandHandler)
      .toSelf();

    handler = container.get<SubmitGovernanceReviewResultCommandHandler>(
      SubmitGovernanceReviewResultCommandHandler,
    );

    allocationPathResolverMock.resolve.mockReturnValue(fixtureResolvedPath);
    repositoryMock.getById.mockResolvedValue(fixtureAllocator);

    vi.clearAllMocks();
  });

  it('should approve governance review, resolve allocation path, and save', async () => {
    const command = new SubmitGovernanceReviewResultCommand('alloc-1', {
      status: PhaseStatus.Approved,
      data: {
        finalDataCap: 10,
        reviewerAddress: '0xabc',
        isMDMAAllocator: false,
        allocatorType: AllocatorType.MDMA,
      } as GovernanceReviewApprovedData,
    });

    await handler.handle(command);

    expect(allocationPathResolverMock.resolve).toHaveBeenCalledWith(AllocatorType.MDMA);
    expect(fixtureAllocator.approveGovernanceReview).toHaveBeenCalledWith(
      expect.objectContaining({
        finalDataCap: 10,
        reviewerAddress: '0xabc',
        isMDMAAllocator: false,
        allocatorType: AllocatorType.MDMA,
      }),
      fixtureResolvedPath,
    );
    expect(fixtureAllocator.rejectGovernanceReview).not.toHaveBeenCalled();
    expect(repositoryMock.save).toHaveBeenCalledWith(fixtureAllocator, -1);
  });

  it('should reject governance review and save', async () => {
    const command = new SubmitGovernanceReviewResultCommand('alloc-2', {
      status: PhaseStatus.Rejected,
      data: {
        reason: 'Insufficient data',
        reviewerAddress: '0xdef',
        isMDMAAllocator: true,
      },
    });

    await handler.handle(command);

    expect(fixtureAllocator.rejectGovernanceReview).toHaveBeenCalledWith({
      reason: 'Insufficient data',
      reviewerAddress: '0xdef',
      isMDMAAllocator: true,
    });
    expect(fixtureAllocator.approveGovernanceReview).not.toHaveBeenCalled();
    expect(repositoryMock.save).toHaveBeenCalledWith(fixtureAllocator, -1);
  });

  it('should throw when allocator not found', async () => {
    repositoryMock.getById.mockResolvedValue(null);

    const command = new SubmitGovernanceReviewResultCommand('missing', {
      status: PhaseStatus.Approved,
      data: {
        finalDataCap: 5,
        reviewerAddress: '0x123',
        isMDMAAllocator: false,
        allocatorType: AllocatorType.RKH,
      } as GovernanceReviewApprovedData,
    });

    await expect(handler.handle(command)).rejects.toThrow('Allocator with id missing not found');
    expect(repositoryMock.save).not.toHaveBeenCalled();
  });

  it('should throw when invalid governance review result', async () => {
    const command = new SubmitGovernanceReviewResultCommand('alloc-3', {
      status: 'INVALID_STATUS' as unknown as typeof PhaseStatus.Approved,
      data: {} as unknown as GovernanceReviewApprovedData,
    });

    await expect(handler.handle(command)).rejects.toThrow('Invalid governance review result');
    expect(repositoryMock.save).not.toHaveBeenCalled();
  });
});
