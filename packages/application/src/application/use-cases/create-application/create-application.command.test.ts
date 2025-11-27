import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatacapAllocator } from '@src/domain/application/application';

import {
  CreateApplicationCommand,
  CreateApplicationCommandHandler,
} from './create-application.command';
import { Container } from 'inversify';
import { TYPES } from '@src/types';

const baseCommandInput = {
  guid: 'guid-123',
  applicationId: 'app-123',
  applicationNumber: 42,
  applicantName: 'Test Applicant',
  applicantAddress: 'f01234',
  applicantOrgName: 'Test Org',
  applicantOrgAddresses: 'addr-1, addr-2',
  allocationTrancheSchedule: 'monthly',
  allocationAudit: 'audit',
  allocationDistributionRequired: 'distribution',
  allocationRequiredStorageProviders: 'providers',
  bookkeepingRepo: 'repo',
  allocationRequiredReplicas: 'replicas',
  datacapAllocationLimits: 'limits',
  applicantGithubHandle: 'main-handle',
  otherGithubHandles: '@FooUser, BarUser\n@baz-user',
  onChainAddressForDataCapAllocation: 'f09999',
};

const mocks = vi.hoisted(() => ({
  getMultisigInfo: vi.fn(),
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  repository: {
    getById: vi.fn(),
    save: vi.fn(),
  },
  lotusClient: {
    getActorId: vi.fn(),
  },
  pullRequestService: {
    createPullRequest: vi.fn(),
  },
}));

vi.mock('@src/infrastructure/clients/filfox', () => ({
  getMultisigInfo: mocks.getMultisigInfo,
}));

describe('CreateApplicationCommandHandler', () => {
  let container: Container;
  let handler: CreateApplicationCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    container = new Container();
    container.bind(TYPES.Logger).toConstantValue(mocks.logger);
    container.bind(TYPES.DatacapAllocatorRepository).toConstantValue(mocks.repository);
    container.bind(TYPES.LotusClient).toConstantValue(mocks.lotusClient);
    container.bind(TYPES.PullRequestService).toConstantValue(mocks.pullRequestService);
    container.bind(CreateApplicationCommandHandler).toSelf();
    handler = container.get(CreateApplicationCommandHandler);

    mocks.getMultisigInfo.mockResolvedValue({
      multisig: {
        signers: ['signer-1', 'signer-2'],
        approvalThreshold: 2,
      },
    });

    mocks.pullRequestService.createPullRequest.mockResolvedValue({
      number: 1,
      url: 'https://github.com/test/test/pull/1',
      commentId: 1,
    });

    mocks.lotusClient.getActorId.mockResolvedValue('f01234');
  });

  describe('normalizeGithubHandles', () => {
    it('returns normalized handles', () => {
      const result = handler.normalizeGithubHandles('@Foo,  Bar \n @baz');
      expect(result).toEqual(['foo', 'bar', 'baz']);
    });

    it('returns an empty array when input is invalid', () => {
      const result = handler.normalizeGithubHandles('');
      expect(result).toEqual([]);
    });
  });

  describe('handle', () => {
    it('returns an error when the application already exists', async () => {
      const existingAllocator = DatacapAllocator.create({
        applicationId: 'existing',
        applicationNumber: 1,
        applicantName: 'Existing',
        applicantAddress: 'f0',
        applicantOrgName: 'Org',
        applicantOrgAddresses: 'Addr',
        allocationTrancheSchedule: 'schedule',
        allocationAudit: 'audit',
        allocationDistributionRequired: 'dist',
        allocationRequiredStorageProviders: 'providers',
        bookkeepingRepo: 'repo',
        allocationRequiredReplicas: 'replicas',
        datacapAllocationLimits: 'limits',
        applicantGithubHandle: 'handle',
        otherGithubHandles: [],
        onChainAddressForDataCapAllocation: 'f011',
      });
      mocks.repository.getById.mockResolvedValue(existingAllocator);
      const result = await handler.handle(new CreateApplicationCommand(baseCommandInput));

      expect(result).toStrictEqual({
        success: false,
        error: new Error('Application already exists'),
      });

      expect(mocks.repository.save).not.toHaveBeenCalled();
      expect(mocks.pullRequestService.createPullRequest).not.toHaveBeenCalled();
    });

    it('should save the application', async () => {
      mocks.repository.getById.mockRejectedValue(null);
      const createApplicationCommand = new CreateApplicationCommand(baseCommandInput);
      const result = await handler.handle(createApplicationCommand);

      expect(result).toStrictEqual({
        success: true,
        data: { guid: baseCommandInput.guid },
      });

      expect(mocks.pullRequestService.createPullRequest).toHaveBeenCalledWith(
        expect.any(DatacapAllocator),
      );
      expect(mocks.pullRequestService.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          guid: baseCommandInput.applicationId,
          applicationNumber: baseCommandInput.applicationNumber,
          applicantName: baseCommandInput.applicantName,
        }),
      );

      expect(mocks.repository.save).toHaveBeenCalledWith(expect.any(DatacapAllocator), -1);
      expect(mocks.repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          guid: baseCommandInput.applicationId,
          applicationNumber: baseCommandInput.applicationNumber,
          applicantName: baseCommandInput.applicantName,
          applicantAddress: baseCommandInput.applicantAddress,
          applicantOrgName: baseCommandInput.applicantOrgName,
          applicantOrgAddresses: baseCommandInput.applicantOrgAddresses,
          allocationTrancheSchedule: baseCommandInput.allocationTrancheSchedule,
          allocationAudit: baseCommandInput.allocationAudit,
          allocationDistributionRequired: baseCommandInput.allocationDistributionRequired,
          allocationRequiredStorageProviders: baseCommandInput.allocationRequiredStorageProviders,
          allocationBookkeepingRepo: baseCommandInput.bookkeepingRepo,
          allocationRequiredReplicas: baseCommandInput.allocationRequiredReplicas,
          allocationDatacapAllocationLimits: baseCommandInput.datacapAllocationLimits,
          applicantGithubHandle: baseCommandInput.applicantGithubHandle,
          onChainAddressForDataCapAllocation: baseCommandInput.onChainAddressForDataCapAllocation,
          allocatorActorId: 'f01234',
          allocatorMultisigAddress: baseCommandInput.onChainAddressForDataCapAllocation,
          allocatorMultisigSigners: ['signer-1', 'signer-2'],
          allocatorMultisigThreshold: 2,
          applicationPullRequest: expect.objectContaining({
            prNumber: 1,
            prUrl: 'https://github.com/test/test/pull/1',
            commentId: 1,
          }),
        }),
        -1,
      );
    });
  });
});
