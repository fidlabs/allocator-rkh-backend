import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';

import Web3 from 'web3';
import config from '@src/config';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';
import { ILotusClient } from '@src/infrastructure/clients/lotus';
import { TYPES } from '@src/types';
import { initialize } from '@src/startup';
import {
  fetchAllowanceChangedEvents,
  fetchDatacapAllocatedEvents,
  fetchCurrentDatacap,
  updateDatacapInfo,
  fetchDatacapLatestUpdateBlock,
  submitRefreshMetaAllocatorCommand,
} from '@src/application/use-cases/refresh-ma-datacap/subscribe-refresh-ma.service';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import {
  ApplicationAllocator,
  ApplicationStatus,
  DatacapAllocator,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import {
  CreateApplicationCommand,
  CreateApplicationCommandHandler,
} from '@src/application/use-cases/create-application/create-application.command';
import {
  CreateRefreshApplicationCommand,
  CreateRefreshApplicationCommandHandler,
} from '@src/application/use-cases/create-application/create-refresh-application.command';
import { createApplicationTest } from './create-app';

const web3 = new Web3(config.LOTUS_RPC_URL);

function decodeError(error: any) {
  const errorData = error.data || '';
  const errorSignatureHash = errorData.slice(0, 10); // This is the first 10 characters, which includes the 0x prefix and 8 characters of the hash

  const amountEqualZeroHash = web3.utils.sha3('AmountEqualZero()');
  const insufficientAllowanceHash = web3.utils.sha3('InsufficientAllowance()');

  console.log('zero hash: ', amountEqualZeroHash?.slice(0, 10));
  console.log('no balance hash: ', insufficientAllowanceHash?.slice(0, 10));

  if (amountEqualZeroHash && errorSignatureHash === amountEqualZeroHash.slice(0, 10)) {
    console.log('Transaction failed with error: Amount is zero.');
  } else {
    if (
      insufficientAllowanceHash &&
      errorSignatureHash === insufficientAllowanceHash.slice(0, 10)
    ) {
      console.log('Transaction failed with error: Insufficient allowance.');
    } else {
      console.log('An unexpected error occurred:', error.signature);
    }
  }
}

async function simulateDatacapAllocatedEvent(
  clientAddress: string,
  allocatorAddress: string,
  allocatorPrivateKey: string,
  contractAddress: string,
  amount: number,
) {
  const contractABI = [
    {
      type: 'error',
      name: 'AmountEqualZero',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InsufficientAllowance',
      inputs: [],
    },
    {
      type: 'function',
      name: 'addVerifiedClient',
      inputs: [
        {
          name: 'clientAddress',
          type: 'bytes',
          internalType: 'bytes',
        },
        {
          name: 'amount',
          type: 'uint256',
          internalType: 'uint256',
        },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ];

  // TODO: if code 402 execution reverted console log what the error event was
  const contract = new web3.eth.Contract(contractABI, contractAddress);
  const data = contract.methods.addVerifiedClient(clientAddress, amount).encodeABI();
  const tx = {
    from: allocatorAddress,
    to: contractAddress,
    gas: 2000000,
    data: data,
    maxPriorityFeePerGas: web3.utils.toWei('2000', 'gwei'),
    maxFeePerGas: web3.utils.toWei('100000', 'gwei'),
  };
  const signedTx = await web3.eth.accounts.signTransaction(tx, allocatorPrivateKey);
  await web3.eth.sendSignedTransaction(signedTx.rawTransaction); // Returns receipt
  return signedTx.transactionHash;
}

async function simulateAddAllowance(
  allocatorAddress: string,
  allocatorPrivateKey: string,
  contractAddress: string,
  amount: number,
) {
  const contractABI = [
    {
      type: 'function',
      name: 'addAllowance',
      inputs: [
        {
          name: 'allocator',
          type: 'address',
          internalType: 'address',
        },
        {
          name: 'amount',
          type: 'uint256',
          internalType: 'uint256',
        },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ];

  const contract = new web3.eth.Contract(contractABI, contractAddress);
  const data = contract.methods.addAllowance(allocatorAddress, amount).encodeABI();
  const tx = {
    from: allocatorAddress,
    to: contractAddress,
    gas: 2000000,
    data: data,
    maxPriorityFeePerGas: web3.utils.toWei('2000', 'gwei'),
    maxFeePerGas: web3.utils.toWei('100000', 'gwei'),
  };

  const signedTx = await web3.eth.accounts.signTransaction(tx, allocatorPrivateKey);
  await web3.eth.sendSignedTransaction(signedTx.rawTransaction); // Returns receipt
  return signedTx.transactionHash;
}

async function logErrorSignatures() {
  const errorABI = [
    {
      type: 'error',
      name: 'AlreadyZero',
      inputs: [],
    },
    {
      type: 'error',
      name: 'AmountEqualZero',
      inputs: [],
    },
    {
      type: 'error',
      name: 'FunctionDisabled',
      inputs: [],
    },
    {
      type: 'error',
      name: 'GetClaimsCallFailed',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InsufficientAllowance',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InvalidAllocationRequest',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InvalidAmount',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InvalidArgument',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InvalidCaller',
      inputs: [
        {
          name: 'caller',
          type: 'address',
          internalType: 'address',
        },
        {
          name: 'expectedCaller',
          type: 'address',
          internalType: 'address',
        },
      ],
    },
    {
      type: 'error',
      name: 'InvalidClaimExtensionRequest',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InvalidOperatorData',
      inputs: [],
    },
    {
      type: 'error',
      name: 'InvalidTokenReceived',
      inputs: [],
    },
    {
      type: 'error',
      name: 'NotAllowedSP',
      inputs: [
        {
          name: 'provider',
          type: 'uint64',
          internalType: 'CommonTypes.FilActorId',
        },
      ],
    },
    {
      type: 'error',
      name: 'NotClient',
      inputs: [],
    },
    {
      type: 'error',
      name: 'NotManager',
      inputs: [],
    },
    {
      type: 'error',
      name: 'TransferFailed',
      inputs: [],
    },
    {
      type: 'error',
      name: 'UnfairDistribution',
      inputs: [
        {
          name: 'maxPerSp',
          type: 'uint256',
          internalType: 'uint256',
        },
        {
          name: 'providedToSingleSp',
          type: 'uint256',
          internalType: 'uint256',
        },
      ],
    },
    {
      type: 'error',
      name: 'UnsupportedToken',
      inputs: [],
    },
    {
      type: 'error',
      name: 'UnsupportedType',
      inputs: [],
    },
  ];

  for (const error of errorABI) {
    let inputTypes = error.inputs.map(input => input.type).join(',');
    let fullSignature = `${error.name}(${inputTypes})`;
    const errorSignatureHash = web3.utils.sha3(fullSignature)?.slice(0, 10);
    console.log(fullSignature, errorSignatureHash);
  }
}

async function testFetchDatacapChangeEvents() {
  const allocatorAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const allocatorPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const clientAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const contractAddress = '0x15A9D9b81E3c67b95Ffedfb4416D25a113C8c6df';

  console.log('Simulate allowance...');
  const txHash = await simulateAddAllowance(
    allocatorAddress,
    allocatorPrivateKey,
    contractAddress,
    100,
  );

  console.log('Finished adding allowance.');
  const currentDatacap = await fetchCurrentDatacap(contractAddress, allocatorAddress);
  console.log('Current datacap: ', currentDatacap);

  //     function setAllowance(address allocator, uint256 amount) external onlyOwner {
  // error: 0x64d954b0

  await simulateDatacapAllocatedEvent(
    clientAddress,
    allocatorAddress,
    allocatorPrivateKey,
    contractAddress,
    20,
  );
  logErrorSignatures();
}

async function testUpdateDatacapInfo(container: Container) {
  /*
    Explanation:

    For given 'allocatorAddress' we simulate an 'AllowanceChanged' event. This lets
    'updateDatacapInfo' know we must update the current datacap for the allocator in
    the MongoDB database.

    If the onchain current datacap matches the current database datacap then:
    
    - 'updateDatacapInfo' correctly picks up 'allocatorsToUpdate'.
    - 'updateDatacapInfo' correctly updates the datacap in the database.
    */

  const allocatorAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const allocatorPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const contractAddress = '0x15A9D9b81E3c67b95Ffedfb4416D25a113C8c6df';

  const latestUpdateBlockStart = await fetchDatacapLatestUpdateBlock(
    'filecoin-plus',
    'applicationDetails',
  );
  console.log(`Latest update block: ${latestUpdateBlockStart}`);

  const repository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );

  if (!(await repository.getByAddress(allocatorAddress))) {
    repository.save(
      {
        id: allocatorAddress,
        number: 1000,
        name: 'name',
        organization: 'organization',
        address: allocatorAddress,
        github: 'github',
        allocationTrancheSchedule: 'type',
        datacap: 0,
        status: ApplicationStatus.KYC_PHASE,
      },
      0,
    );
  }

  const datacapUpdateAmount = 100;
  const lastBlock = -1;

  console.log(`Adding allowance to allocator ${allocatorAddress}...`);
  const txHash = await simulateAddAllowance(
    allocatorAddress,
    allocatorPrivateKey,
    contractAddress,
    datacapUpdateAmount,
  );
  console.log(`Finished adding allowance of: ${datacapUpdateAmount}.`);

  const currentDatacap = await fetchCurrentDatacap(contractAddress, allocatorAddress);
  console.log(`Updating datacap info since ${lastBlock + 1}...`);
  await updateDatacapInfo('filecoin-plus', 'applicationDetails', lastBlock + 1);

  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const applicationDetails = await applicationDetailsRepository.getByAddress(allocatorAddress);
  if (!applicationDetails) {
    console.error(`Application details not found for allocator: ${allocatorAddress}`);
    return;
  }

  const databaseDatacap = applicationDetails?.datacapInfo?.latestDatacap;
  console.log(
    `Onchain: ${currentDatacap} Database: ${databaseDatacap} Match: ${currentDatacap === databaseDatacap}`,
  );

  const latestUpdateBlock = await fetchDatacapLatestUpdateBlock(
    'filecoin-plus',
    'applicationDetails',
  );
  console.log(`Latest update block: ${latestUpdateBlock}`);
}

async function testSubmitRefreshMetaAllocatorCommand(container: Container) {
  const allocatorAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const contractAddress = '0x15A9D9b81E3c67b95Ffedfb4416D25a113C8c6df';
  const allocatorPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const datacapUpdateAmount = 100;

  const logger = container.get<Logger>(TYPES.Logger);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const repository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const lastBlock = -1;

  // Ensure allocator has datacap:
  console.log(`Adding allowance to allocator ${allocatorAddress}...`);
  const txHash = await simulateAddAllowance(
    allocatorAddress,
    allocatorPrivateKey,
    contractAddress,
    datacapUpdateAmount,
  );
  console.log(`Finished adding allowance of: ${datacapUpdateAmount}.`);

  const currentDatacap = await fetchCurrentDatacap(contractAddress, allocatorAddress);

  // Ensure currentDatacap is below the minimum threshold:
  const initialDatacap = (100 / config.REFRESH_MIN_THRESHOLD_PCT) * currentDatacap;

  // Ensure status is 'APPROVED' and 'applicationInstruction' is present:
  await repository.update({
    id: allocatorAddress,
    number: 1000,
    name: 'name',
    organization: 'organization',
    address: allocatorAddress,
    github: 'github',
    allocationTrancheSchedule: 'type',
    datacap: 0,
    status: ApplicationStatus.APPROVED,
    // TODO this test has rotted, no longer reflects updates to structures
    applicationInstructions: [
      {
        datacap_amount: initialDatacap,
        method: ApplicationAllocator.META_ALLOCATOR,
      },
    ],
  });

  const allocatorRepository = container.get<IDatacapAllocatorRepository>(
    TYPES.DatacapAllocatorRepository,
  );
  let allocator: DatacapAllocator;

  // Ensure allocator exists in DatacapAllocatorRepository:
  try {
    allocator = await allocatorRepository.getById(allocatorAddress);
  } catch (error) {
    await createApplicationTest(container, allocatorAddress);
    allocator = await allocatorRepository.getById(allocatorAddress);
  }

  console.log(`Updating datacap info since ${lastBlock + 1}...`);
  const datacapMap = await updateDatacapInfo('filecoin-plus', 'applicationDetails', lastBlock + 1);
  console.log(`Submitting refresh meta allocator command...`);

  for (let [allocatorAddress, allocatorData] of datacapMap) {
    await submitRefreshMetaAllocatorCommand(
      allocatorAddress,
      allocatorData.datacapInfo,
      config.REFRESH_MIN_THRESHOLD_PCT,
      repository,
      commandBus,
      logger,
    );
    break;
  }
}

async function main() {
  /*
    Functions to test:

    1. fetchEventLogs: DONE (by testUpdateDatacapInfo)
    2. fetchAllowanceChangedEvents: DONE (by testUpdateDatacapInfo)
    3. fetchDatacapAllocatedEvents: TODO (*)
    4. fetchAllocatorsToUpdate: PARTIAL (by testUpdateDatacapInfo) (*)
    - Requires testing 'fetchDatacapAllocatedEvents'
    5. fetchCurrentDatacap: DONE (by testUpdateDatacapInfo)
    6. UpdateDatacapInfo: DONE (by testUpdateDatacapInfo)
    7. fetchDatacapLatestUpdateBlock: DONE (by testUpdateDatacapInfo)
    8. CreateRefreshApplicationCommand: DONE (by testSubmitRefreshMetaAllocatorCommand)
    */

  const container = await initialize();
  await testSubmitRefreshMetaAllocatorCommand(container);
  // await testUpdateDatacapInfo(container)
  // await testFetchDatacapChangeEvents()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
