import { ApplicationInstruction, DatacapAllocator } from '@src/domain/application/application';
import { ApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import config from '@src/config';
import { epochToZulu, zuluToEpoch } from '@filecoin-plus/core';
import { getMultisigInfo } from '@src/infrastructure/clients/filfox';

type AuditCycle = {
  started: string;
  ended: string;
  dc_allocated: string;
  outcome: string; //"PENDING" | "APPROVED" | "REJECTED" | "DOUBLE" | "THROTTLE" | "MATCH",
  datacap_amount: number;
};

export type ApplicationPullRequestFile = {
  application_number: number;
  address: string;
  name: string;
  allocator_id: string;
  organization: string;
  //allocation_bookkeeping: string,
  metapathway_type: string | undefined;
  ma_address: string | undefined;
  associated_org_addresses: string;
  pathway_addresses?: {
    msig: string;
    signers: string[];
  };
  application: {
    allocations: string[];
    audit: string[];
    tranche_schedule: string;
    distribution: string[];
    required_sps: string;
    required_replicas: string;
    tooling: string[];
    max_DC_client: string;
    github_handles: string[];
    allocation_bookkeeping: string;
    client_contract_address: string;
  };
  history: {
    [key: string]: string;
  };
  audits: AuditCycle[];
  old_allocator_id: string;
};

export async function mapApplicationToPullRequestFile(
  application: DatacapAllocator,
): Promise<ApplicationPullRequestFile> {
  console.log('application.applicationInstructions', application.applicationInstructions);

  const lifeCycle: AuditCycle[] = application.applicationInstructions.map(ao => ({
    started: ao.startTimestamp ? epochToZulu(ao.startTimestamp) : '',
    ended: ao.endTimestamp ? epochToZulu(ao.endTimestamp) : '',
    dc_allocated: ao.allocatedTimestamp ? epochToZulu(ao.allocatedTimestamp) : '',
    outcome: ao.status || 'PENDING',
    datacap_amount: ao.datacap_amount || 0,
  }));

  //Convert timestamps to human readable zulu format
  const hrHistory = {
    'Application Submitted': application.status['Application Submitted']
      ? epochToZulu(application.status['Application Submitted'])
      : '',
    'KYC Submitted': application.status['KYC Submitted']
      ? epochToZulu(application.status['KYC Submitted'])
      : '',
    Approved: application.status['Approved'] ? epochToZulu(application.status['Approved']) : '',
    Declined: application.status['Declined'] ? epochToZulu(application.status['Declined']) : '',
    'DC Allocated': application.status['DC Allocated']
      ? epochToZulu(application.status['DC Allocated'])
      : '',
  };

  //get current values of msig
  let allocatorAddress = application.allocatorMultisigAddress ?? '';
  let updatedSigners = application.allocatorMultisigSigners ?? [];
  let allocatorId = '';

  //if we have an on-chain address, fetch the latest from Filfox
  if (application.allocatorMultisigAddress) {
    try {
      const msigData = await getMultisigInfo(application.allocatorMultisigAddress);

      if (msigData.robust !== application.allocatorMultisigAddress) {
        allocatorAddress = msigData.robust;
      }
      allocatorId = msigData.address;
      const fetchedSigners = msigData.multisig.signers;
      if (JSON.stringify(fetchedSigners) !== JSON.stringify(application.allocatorMultisigSigners)) {
        updatedSigners = fetchedSigners;
      }
    } catch (err) {
      /* Note to future maintainers: if *any part* of this fails,
        we must keep the old values otherwise things can get
        wacky. If you introduce code later which can cause
        exceptions from anywhere other than `getMultisigInfo`
        then make sure you maintain this promise!
      */

      console.error(
        `mapApplicationToPullRequestFile: failed to fetch Filfox info for ${
          application.allocatorMultisigAddress
        }:`,
        err,
      );
    }
  }

  return {
    application_number: application?.applicationPullRequest?.prNumber,
    address: application.applicantAddress,
    name: application.applicantName,
    allocator_id: allocatorId,
    organization: application.applicantOrgName,
    //allocation_bookkeeping: application.allocationBookkeepingRepo,
    metapathway_type: application.pathway,
    ma_address: application.ma_address,
    pathway_addresses: {
      msig: allocatorAddress,
      signers: updatedSigners,
    },
    associated_org_addresses: application.applicantOrgAddresses,
    application: {
      allocations: application.allocationStandardizedAllocations,
      audit: application.allocationAudit ? [application.allocationAudit] : [],
      distribution: application.allocationDistributionRequired
        ? [application.allocationDistributionRequired]
        : [],
      tranche_schedule: application.allocationTrancheSchedule,
      required_sps: application.allocationRequiredStorageProviders,
      required_replicas: application.allocationRequiredReplicas,
      tooling: application.allocationTooling,
      max_DC_client: application.allocationMaxDcClient,
      github_handles: [
        application.applicantGithubHandle,
        ...(application.applicantOtherGithubHandles ?? []),
      ],
      allocation_bookkeeping: application.allocationBookkeepingRepo,
      client_contract_address: '',
    },
    history: hrHistory,
    audits: lifeCycle,
    old_allocator_id: '',
  };
}
