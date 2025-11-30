import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest';
import { ApplicationInstructionStatus, ApplicationStatus, DatacapAllocator } from './application';
import { ApplicationEdited, RKHApprovalCompleted } from './application.events';
import { ApplicationError, zuluToEpoch } from '@filecoin-plus/core';
import { StatusCodes } from 'http-status-codes';
import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types';
import { AllocatorType } from '../types';

describe('Application', () => {
  const fixtureApplicationParams = {
    applicationId: '123',
    applicationNumber: 123,
    applicantName: 'John Doe',
    applicantAddress: '123',
    applicantOrgName: 'Org',
    applicantOrgAddresses: '123',
    allocationTrancheSchedule: '123',
    allocationAudit: '123',
    allocationDistributionRequired: '123',
    allocationRequiredStorageProviders: '123',
    bookkeepingRepo: '123',
    allocationRequiredReplicas: '123',
    datacapAllocationLimits: '123',
    applicantGithubHandle: '123',
    otherGithubHandles: ['123'],
    onChainAddressForDataCapAllocation: '123',
  };

  /**
   * all fields are different from fixtureApplicationParams to be sure all fields are being set correctly
   */
  const fixtureApplicationPullRequestFile = {
    application_number: 456,
    address: '456',
    name: 'Jane Doe',
    organization: 'Org',
    associated_org_addresses: '456',
    metapathway_type: 'MDMA',
    ma_address: '456',
    allocator_id: '456',
    application: {
      allocations: ['456'],
      audit: ['456'],
      tranche_schedule: 'Monthly',
      distribution: ['456'],
      required_sps: '10',
      required_replicas: '3',
      tooling: ['smart_contract_allocator'],
      max_DC_client: '1',
      github_handles: ['456'],
      allocation_bookkeeping: 'https://github.com/test/repo',
      client_contract_address: '456',
    },
    history: {
      '456': '2021-01-01T00:00:00.000Z',
    },
    audits: [
      {
        started: '2021-01-01T00:00:00.000Z',
        ended: '2021-01-01T00:00:00.000Z',
        dc_allocated: '2021-01-01T00:00:00.000Z',
        datacap_amount: 456,
        outcome: 'GRANTED',
      },
    ],
    old_allocator_id: '456',
    pathway_addresses: {
      msig: 'f081',
      signers: ['f081'],
    },
  } satisfies ApplicationPullRequestFile;

  it('should create an application via constructor', () => {
    const application = new DatacapAllocator('123');
    expect(application.guid).toBe('123');
  });

  describe('completeRKHApproval', () => {
    const fixtureNow = new Date('2021-01-01T00:00:00.000Z');
    let application: DatacapAllocator;
    let applyChangeSpy: MockInstance;
    let applyRKHApprovalCompletedSpy: MockInstance;

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixtureNow);
    });

    beforeEach(() => {
      application = DatacapAllocator.create(fixtureApplicationParams);
      applyChangeSpy = vi.spyOn(application, 'applyChange');
      applyRKHApprovalCompletedSpy = vi.spyOn(application, 'applyRKHApprovalCompleted');
      application.applicationInstructions = [
        {
          method: 'RKH_ALLOCATOR',
          datacap_amount: 123,
          startTimestamp: 123,
          endTimestamp: 123,
        },
      ];
      application.applicationStatus = ApplicationStatus.RKH_APPROVAL_PHASE;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('should update application correctly', () => {
      application.completeRKHApproval();

      expect(application.applicationStatus).toEqual(ApplicationStatus.DC_ALLOCATED);
      expect(application.allocationTooling).toEqual([]);
      expect(application.pathway).toEqual('RKH');
      expect(application.ma_address).toEqual(application.rkh_address);
      expect(application.applicationInstructions[0].allocatedTimestamp).toEqual(
        fixtureNow.getTime(),
      );
      expect(application.applicationInstructions[0].status).toEqual(
        ApplicationInstructionStatus.GRANTED,
      );
      expect(application.applicationInstructions[0].datacap_amount).toEqual(123);
      expect(application.status['DC Allocated']).toEqual(fixtureNow.getTime());
    });

    it('should apply change correctly', () => {
      application.completeRKHApproval();

      expect(applyChangeSpy).toHaveBeenCalledTimes(1);
      expect(applyChangeSpy).toHaveBeenCalledWith(expect.any(RKHApprovalCompleted));
      expect(applyChangeSpy).toHaveBeenCalledWith({
        aggregateId: application.guid,
        aggregateName: 'allocator',
        eventName: RKHApprovalCompleted.name,
        timestamp: fixtureNow,
        source: 'api',
        applicationInstructions: application.applicationInstructions,
      });
    });

    it('should complete RKH approval successfully with correct aggregate apply method', () => {
      application.completeRKHApproval();

      expect(applyRKHApprovalCompletedSpy).toHaveBeenCalledTimes(1);
      expect(applyRKHApprovalCompletedSpy).toHaveBeenCalledWith({
        aggregateName: 'allocator',
        eventName: RKHApprovalCompleted.name,
        timestamp: fixtureNow,
        aggregateId: application.guid,
        source: 'api',
        applicationInstructions: application.applicationInstructions,
      });
    });

    it.each`
      applicationStatus
      ${ApplicationStatus.KYC_PHASE}
      ${ApplicationStatus.GOVERNANCE_REVIEW_PHASE}
      ${ApplicationStatus.META_APPROVAL_PHASE}
      ${ApplicationStatus.APPROVED}
      ${ApplicationStatus.REJECTED}
      ${ApplicationStatus.IN_REFRESH}
      ${ApplicationStatus.DC_ALLOCATED}
      ${ApplicationStatus.REJECTED}
    `(
      'should throw an error if $applicationStatus is not allowed to complete RKH approval',
      ({ applicationStatus }) => {
        application.applicationStatus = applicationStatus;
        expect(() => application.completeRKHApproval()).toThrow(
          new ApplicationError(
            StatusCodes.BAD_REQUEST,
            '5308',
            'Invalid operation for the current phase',
          ),
        );
      },
    );
  });

  describe('edit', () => {
    const fixtureNow = new Date('2021-01-01T00:00:00.000Z');
    let application: DatacapAllocator;
    let applyChangeSpy: MockInstance;
    let applyApplicationEditedSpy: MockInstance;

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixtureNow);
    });

    beforeEach(() => {
      application = DatacapAllocator.create(fixtureApplicationParams);
      applyChangeSpy = vi.spyOn(application, 'applyChange');
      applyApplicationEditedSpy = vi.spyOn(application, 'applyApplicationEdited');
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('should edit the application correctly for RKH approval phase', () => {
      application.applicationStatus = ApplicationStatus.RKH_APPROVAL_PHASE;
      application.edit(fixtureApplicationPullRequestFile);

      expect(applyChangeSpy).toHaveBeenCalledTimes(1);
      expect(applyChangeSpy).toHaveBeenCalledWith(expect.any(ApplicationEdited));
      expect(applyApplicationEditedSpy).toHaveBeenCalledTimes(1);
      expect(applyApplicationEditedSpy).toHaveBeenCalledWith(expect.any(ApplicationEdited));
      expect(applyChangeSpy).toHaveBeenCalledWith({
        aggregateId: application.guid,
        aggregateName: 'allocator',
        eventName: ApplicationEdited.name,
        timestamp: fixtureNow,
        source: 'api',
        file: {
          application_number: fixtureApplicationPullRequestFile.application_number,
          address: fixtureApplicationPullRequestFile.address,
          name: fixtureApplicationPullRequestFile.name,
          organization: fixtureApplicationPullRequestFile.organization,
          associated_org_addresses: fixtureApplicationPullRequestFile.associated_org_addresses,
          metapathway_type: fixtureApplicationPullRequestFile.metapathway_type,
          ma_address: fixtureApplicationPullRequestFile.ma_address,
          allocator_id: fixtureApplicationPullRequestFile.allocator_id,
          application: {
            allocations: fixtureApplicationPullRequestFile.application.allocations,
            audit: fixtureApplicationPullRequestFile.application.audit,
            tranche_schedule: fixtureApplicationPullRequestFile.application.tranche_schedule,
            distribution: fixtureApplicationPullRequestFile.application.distribution,
            required_sps: fixtureApplicationPullRequestFile.application.required_sps,
            required_replicas: fixtureApplicationPullRequestFile.application.required_replicas,
            tooling: fixtureApplicationPullRequestFile.application.tooling,
            max_DC_client: fixtureApplicationPullRequestFile.application.max_DC_client,
            github_handles: fixtureApplicationPullRequestFile.application.github_handles,
            allocation_bookkeeping:
              fixtureApplicationPullRequestFile.application.allocation_bookkeeping,
            client_contract_address:
              fixtureApplicationPullRequestFile.application.client_contract_address,
          },
          history: fixtureApplicationPullRequestFile.history,
          audits: fixtureApplicationPullRequestFile.audits,
          old_allocator_id: fixtureApplicationPullRequestFile.old_allocator_id,
          pathway_addresses: fixtureApplicationPullRequestFile.pathway_addresses,
        },
      });
    });

    it('should edit the application correctly for Meta approval phase', () => {
      application.applicationStatus = ApplicationStatus.META_APPROVAL_PHASE;
      application.isMetaAllocator = true;
      application.isMDMA = true;
      application.edit(fixtureApplicationPullRequestFile);

      expect(applyChangeSpy).toHaveBeenCalledTimes(1);
      expect(applyChangeSpy).toHaveBeenCalledWith(expect.any(ApplicationEdited));
      expect(applyApplicationEditedSpy).toHaveBeenCalledTimes(1);
      expect(applyApplicationEditedSpy).toHaveBeenCalledWith(expect.any(ApplicationEdited));
      expect(application.pathway).toEqual(fixtureApplicationPullRequestFile.metapathway_type);
      expect(application.ma_address).toEqual(fixtureApplicationPullRequestFile.ma_address);
      expect(application.allocationTooling).toEqual(['smart_contract_allocator']);
      expect(application.allocationStandardizedAllocations).toEqual(
        fixtureApplicationPullRequestFile.application.allocations,
      );
      expect(application.allocationAudit).toEqual(
        fixtureApplicationPullRequestFile.application.audit[0],
      );
      expect(application.allocationDistributionRequired).toEqual(
        fixtureApplicationPullRequestFile.application.distribution[0],
      );
      expect(application.allocationTrancheSchedule).toEqual(
        fixtureApplicationPullRequestFile.application.tranche_schedule,
      );
      expect(application.allocationRequiredReplicas).toEqual(
        fixtureApplicationPullRequestFile.application.required_replicas,
      );
      expect(application.allocationRequiredStorageProviders).toEqual(
        fixtureApplicationPullRequestFile.application.required_sps,
      );
      expect(application.allocationMaxDcClient).toEqual(
        fixtureApplicationPullRequestFile.application.max_DC_client,
      );
      expect(application.applicantGithubHandle).toEqual(
        fixtureApplicationPullRequestFile.application.github_handles[0],
      );
      expect(application.onChainAddressForDataCapAllocation).toEqual(
        fixtureApplicationPullRequestFile.application.client_contract_address,
      );
      expect(application.allocationBookkeepingRepo).toEqual(
        fixtureApplicationPullRequestFile.application.allocation_bookkeeping,
      );
      expect(application.allocatorMultisigAddress).toEqual(
        fixtureApplicationPullRequestFile.pathway_addresses?.msig,
      );
      expect(application.allocatorMultisigSigners).toEqual(
        fixtureApplicationPullRequestFile.pathway_addresses?.signers,
      );
      expect(application.applicationInstructions).toEqual(
        fixtureApplicationPullRequestFile.audits.map(ao => ({
          method: (fixtureApplicationPullRequestFile.metapathway_type as AllocatorType) || '',
          startTimestamp: zuluToEpoch(ao.started),
          endTimestamp: zuluToEpoch(ao.ended),
          allocatedTimestamp: zuluToEpoch(ao.dc_allocated),
          status: ao.outcome || 'PENDING',
          datacap_amount: ao.datacap_amount || 0,
        })),
      );
    });

    it('should handle defaults for missing fields in meta approval phase', () => {
      application.allocationTooling = [];
      application.isMetaAllocator = true;
      application.isMDMA = true;
      application.pathway = 'TEST';
      application.ma_address = 'TEST';

      application.edit({
        ...fixtureApplicationPullRequestFile,
        ma_address: undefined,
        metapathway_type: undefined,
      });

      expect(application.pathway).toEqual('MDMA');
      expect(application.ma_address).toEqual(application.mdma_address);
      expect(application.allocationTooling).toEqual(['smart_contract_allocator']);
    });

    it('should set default values for missing fields in RKH approval phase', () => {
      application.allocationTooling = [];
      application.pathway = 'TEST';
      application.ma_address = 'TEST';
      application.isMetaAllocator = false;
      application.isMDMA = true;

      application.edit({
        ...fixtureApplicationPullRequestFile,
        metapathway_type: undefined,
        ma_address: undefined,
      });

      expect(application.pathway).toEqual('RKH');
      expect(application.ma_address).toEqual(application.rkh_address);
      expect(application.allocationTooling).toEqual([]);
    });
  });
});
