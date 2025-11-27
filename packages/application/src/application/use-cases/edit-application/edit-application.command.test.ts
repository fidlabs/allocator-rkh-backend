import { TYPES } from '@src/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditApplicationCommand, EditApplicationCommandHandler } from './edit-application.command';
import { Container } from 'inversify';
import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types';
import { DatacapAllocator } from '@src/domain/application/application';

const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn((...args) => console.log(...args)),
    error: vi.fn((...args) => console.error(...args)),
    debug: vi.fn((...args) => console.debug(...args)),
  },
  repository: {
    getById: vi.fn(),
    save: vi.fn(),
  },
}));

describe('EditApplicationCommandHandler', () => {
  let container: Container;
  let handler: EditApplicationCommandHandler;

  const fixtureApplicationPullRequestFile: ApplicationPullRequestFile = {
    application_number: 123,
    address: '0x123',
    name: 'Test Application',
    allocator_id: '123',
    organization: 'Test Organization',
    audits: [],
    metapathway_type: 'META_ALLOCATOR',
    ma_address: '0x123',
    associated_org_addresses: '0x123',
    pathway_addresses: {
      msig: '0x123',
      signers: ['0x123'],
    },
    application: {
      allocations: ['0x123'],
      audit: ['0x123'],
      tranche_schedule: 'Monthly',
      distribution: ['0x123'],
      required_sps: '10',
      required_replicas: '3',
      tooling: ['smart_contract_allocator'],
      max_DC_client: '1',
      github_handles: ['0x123'],
      allocation_bookkeeping: 'https://github.com/test/repo',
      client_contract_address: '0x123',
    },
    history: {},
    old_allocator_id: '',
  };

  beforeEach(() => {
    container = new Container();
    container.bind(TYPES.Logger).toConstantValue(mocks.logger);
    container.bind(TYPES.DatacapAllocatorRepository).toConstantValue(mocks.repository);
    container.bind(EditApplicationCommandHandler).toSelf();
    handler = container.get(EditApplicationCommandHandler);

    mocks.repository.getById.mockImplementation(
      (id: string) =>
        ({
          existing: DatacapAllocator.create({
            applicationId: id,
            applicationNumber: 123,
            applicantName: 'initial applicant',
            applicantAddress: '0x123',
            applicantOrgName: 'initial org',
            applicantOrgAddresses: '0x123',
            allocationTrancheSchedule: 'initial tranche schedule',
            allocationAudit: 'initial audit',
            allocationDistributionRequired: 'initial distribution required',
            allocationRequiredStorageProviders: 'initial storage providers',
            allocationRequiredReplicas: 'initial replicas',
            datacapAllocationLimits: 'initial datacap limits',
            applicantGithubHandle: 'initial github handle',
            otherGithubHandles: ['initial github handle 2'],
            onChainAddressForDataCapAllocation: 'initial on chain address',
            bookkeepingRepo: 'initial bookkeeping repo',
          }),
        })[id],
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should edit an application', async () => {
    const command = new EditApplicationCommand({
      applicationId: 'existing',
      file: fixtureApplicationPullRequestFile,
    });
    const result = await handler.handle(command);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        guid: 'existing',
        applicationNumber: fixtureApplicationPullRequestFile.application_number,
        applicantName: fixtureApplicationPullRequestFile.name,
        applicantAddress: fixtureApplicationPullRequestFile.address,
        applicantOrgName: fixtureApplicationPullRequestFile.organization,
        applicantOrgAddresses: fixtureApplicationPullRequestFile.associated_org_addresses,
        allocationTrancheSchedule: fixtureApplicationPullRequestFile.application.tranche_schedule,
        allocationAudit: fixtureApplicationPullRequestFile.application.audit[0],
        allocationDistributionRequired:
          fixtureApplicationPullRequestFile.application.distribution[0],
        allocationRequiredStorageProviders:
          fixtureApplicationPullRequestFile.application.required_sps,
        allocationRequiredReplicas: fixtureApplicationPullRequestFile.application.required_replicas,
        applicantGithubHandle: fixtureApplicationPullRequestFile.application.github_handles[0],
        onChainAddressForDataCapAllocation:
          fixtureApplicationPullRequestFile.application.client_contract_address,
      }),
    });
  });
});
