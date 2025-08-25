import { ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import config from '@src/config';
import { ethers } from 'ethers';
import { MongoClient } from 'mongodb';
import { CreateRefreshApplicationCommand } from '../create-application/create-refresh-application.command';
import { ApplicationAllocator, ApplicationInstruction } from '@src/domain/application/application';

const ALLOWANCE_CHANGED_EVENT_ABI = [
  {
    type: 'event',
    name: 'AllowanceChanged',
    inputs: [
      {
        name: 'allocator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'allowanceBefore',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'allowanceAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
];

const DATACAP_ALLOCATED_EVENT_ABI = [
  {
    type: 'event',
    name: 'DatacapAllocated',
    inputs: [
      {
        name: 'allocator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'client',
        type: 'bytes',
        indexed: true,
        internalType: 'bytes',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
];

type AllowanceChangedEvent = {
  blockNumber: number;
  txHash: string;
  allocatorAddress: string;
  allowanceBefore: string;
  allowanceAfter: string;
};

type DatacapAllocatedEvent = {
  blockNumber: number;
  txHash: string;
  allocatorAddress: string;
  amount: number;
};

export function ensureSubscribeRefreshMetaAllocatorConfig() {
  const expectedConfigVars = [
    'SUBSCRIBE_REFRESH_META_ALLOCATOR_POLLING_INTERVAL',
    'META_ALLOCATOR_CONTRACT_ADDRESS',
    'EVM_RPC_URL',
    'MONGODB_URI',
  ];
  for (let configVar of expectedConfigVars) {
    if (!config[configVar]) {
      throw new Error(`Missing config variable: '${configVar}'`);
    }
  }
}

async function fetchEventLogs(
  fromBlock: number,
  eventName: string,
  eventABI: any[],
  toBlock?: number,
): Promise<any[]> {
  const provider = new ethers.providers.JsonRpcProvider(config.EVM_RPC_URL);
  const iface = new ethers.utils.Interface(eventABI);
  const eventTopic = iface.getEventTopic(eventName);
  const filter = {
    fromBlock: fromBlock,
    toBlock: toBlock || 'latest',
    topics: [eventTopic],
  };
  let logs: any[];
  try {
    logs = await provider.getLogs(filter);
  } catch (error) {
    return [];
  }
  return logs;
}

export async function fetchAllowanceChangedEvents(
  fromBlock: number,
  toBlock?: number,
): Promise<AllowanceChangedEvent[]> {
  const eventABI = ALLOWANCE_CHANGED_EVENT_ABI;
  const eventName = 'AllowanceChanged';
  const logs = await fetchEventLogs(fromBlock, eventName, eventABI, toBlock);
  const iface = new ethers.utils.Interface(eventABI);
  const events: AllowanceChangedEvent[] = [];
  for (let log of logs) {
    try {
      const decoded = iface.decodeEventLog(eventName, log.data, log.topics);
      if (decoded) {
        const event: AllowanceChangedEvent = {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          allocatorAddress: decoded.allocator,
          allowanceBefore: decoded.allowanceBefore.toString(),
          allowanceAfter: decoded.allowanceAfter.toString(),
        };
        events.push(event);
      }
    } catch (error) {
      continue;
    }
  }
  return events;
}

export async function fetchDatacapAllocatedEvents(
  fromBlock: number,
  toBlock?: number,
): Promise<DatacapAllocatedEvent[]> {
  const eventABI = DATACAP_ALLOCATED_EVENT_ABI;
  const eventName = 'DatacapAllocated';
  const logs = await fetchEventLogs(fromBlock, eventName, eventABI, toBlock);
  const iface = new ethers.utils.Interface(eventABI);
  const events: DatacapAllocatedEvent[] = [];
  for (let log of logs) {
    try {
      const decoded = iface.decodeEventLog(eventName, log.data, log.topics);
      if (decoded) {
        const event: DatacapAllocatedEvent = {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          allocatorAddress: decoded.allocator,
          amount: decoded.amount,
        };
        events.push(event);
      }
    } catch (error) {
      continue;
    }
  }
  return events;
}

export async function fetchCurrentDatacap(
  contractAddress: string,
  allocatorAddress: string,
): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(config.EVM_RPC_URL);
  const functionABI = [
    {
      type: 'function',
      name: 'allowance',
      inputs: [
        {
          name: 'allocator',
          type: 'address',
          internalType: 'address',
        },
      ],
      outputs: [
        {
          name: 'allowance_',
          type: 'uint256',
          internalType: 'uint256',
        },
      ],
      stateMutability: 'view',
    },
  ];
  const contract = new ethers.Contract(contractAddress, functionABI, provider);
  const allowance = await contract.allowance(allocatorAddress);
  const allowanceNumber = allowance.toNumber();
  return allowanceNumber;
}

async function fetchAllocatorsToUpdate(
  fromBlock: number,
  toBlock?: number,
): Promise<{
  allocatorAddresses: string[];
  lastBlock: number;
}> {
  const allowanceChangedEvents = await fetchAllowanceChangedEvents(fromBlock, toBlock);
  const datacapAllocatedEvents = await fetchDatacapAllocatedEvents(fromBlock, toBlock);
  const allocatorAddresses = new Set<string>();
  let lastBlock = fromBlock;
  for (let event of allowanceChangedEvents) {
    allocatorAddresses.add(event.allocatorAddress);
    if (event.blockNumber > lastBlock) {
      lastBlock = event.blockNumber;
    }
  }
  for (let event of datacapAllocatedEvents) {
    allocatorAddresses.add(event.allocatorAddress);
    if (event.blockNumber > lastBlock) {
      lastBlock = event.blockNumber;
    }
  }
  return { allocatorAddresses: Array.from(allocatorAddresses), lastBlock: lastBlock };
}

export async function fetchDatacapLatestUpdateBlock(
  databaseName: string,
  collectionName: string,
): Promise<number> {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const document = await collection
      .find({ datacapInfo: { $exists: true } })
      .sort({ 'datacapInfo.latestUpdateBlock': -1 })
      .limit(1)
      .toArray();

    if (document.length > 0) {
      return document[0].datacapInfo.latestUpdateBlock;
    } else {
      return -1;
    }
  } catch (error) {
    return -1;
  } finally {
    await client.close();
  }
}

export async function updateDatacapInfo(
  databaseName: string,
  collectionName: string,
  fromBlock: number,
): Promise<Map<string, any>> {
  const { allocatorAddresses: allocatorsToUpdate, lastBlock } =
    await fetchAllocatorsToUpdate(fromBlock);
  const datacapMap = new Map<string, any>();

  for (let allocatorAddress of allocatorsToUpdate) {
    const currentDatacap = await fetchCurrentDatacap(
      config.META_ALLOCATOR_CONTRACT_ADDRESS,
      allocatorAddress,
    );
    datacapMap.set(allocatorAddress, {
      datacapInfo: {
        latestDatacap: currentDatacap,
        latestUpdateBlock: lastBlock,
      },
    });
  }

  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const bulkUpdateOps = allocatorsToUpdate.map(allocatorAddress => ({
      updateOne: {
        filter: { address: allocatorAddress },
        update: { $set: { datacapInfo: datacapMap.get(allocatorAddress).datacapInfo } },
      },
    }));
    if (bulkUpdateOps.length > 0) {
      await collection.bulkWrite(bulkUpdateOps);
    }
  } catch (error) {
    console.error('Failed to write to database:', error);
  } finally {
    await client.close();
  }
  return datacapMap;
}

export async function submitRefreshMetaAllocatorCommand(
  allocatorAddress: string,
  datacapInfo: any,
  minThresholdPct: number,
  repository: IApplicationDetailsRepository,
  commandBus: ICommandBus,
  logger: Logger,
) {
  const applicationDetails = await repository.getByAddress(allocatorAddress);
  // Ensure applicationDetails exist
  if (!applicationDetails) {
    logger.debug(`Application details not found for allocator: ${allocatorAddress}`);
    return;
  }
  // Ensure status is APPROVED
  // if (applicationDetails.status !== 'APPROVED') {
  //     logger.debug(`Application status not APPROVED for allocator: ${allocatorAddress}`)
  //     return
  // }
  // Ensure applicationInstruction is defined
  if (!applicationDetails.applicationInstructions) {
    logger.debug(`Missing applicaitonInstruction for allocator: ${allocatorAddress}`);
    return;
  }
  // Ensure lastInstruction.method exists
  let applicationInstructionsLength: number;
  let lastInstruction: ApplicationInstruction;
  let lastInstructionMethod: string;
  let lastInstructionAmount: number;
  try {
    applicationInstructionsLength = applicationDetails.applicationInstructions.length;
    lastInstruction = applicationDetails.applicationInstructions[applicationInstructionsLength - 1];
    lastInstructionMethod = lastInstruction.method;
    lastInstructionAmount = lastInstruction.datacap_amount;
  } catch (error) {
    logger.error('Invalid applicationInstructions.');
    return;
  }
  // Ensure instruction method is META_ALLOCATOR
  if (lastInstructionMethod !== ApplicationAllocator.META_ALLOCATOR) {
    logger.debug(`Invalid applicationInstruction method for allocator: ${allocatorAddress}`);
    return;
  }
  try {
    const currentDatacap = datacapInfo.latestDatacap;
    const initialDatacap = lastInstructionAmount;
    logger.info(`Current Datacap: ${currentDatacap}, Initial Datacap: ${initialDatacap}`);
    const pct = (Number(currentDatacap) / Number(initialDatacap)) * 100;
    if (pct <= minThresholdPct) {
      const applicationId = applicationDetails.id;
      const command = new CreateRefreshApplicationCommand(applicationId);
      await commandBus.send(command);
    }
  } catch (error) {}
}

export async function subscribeRefreshMetaAllocator(container: Container) {
  const logger = container.get<Logger>(TYPES.Logger);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const repository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );

  let shouldContinue = true;

  const intervalId = setInterval(async () => {
    try {
      ensureSubscribeRefreshMetaAllocatorConfig();
    } catch (error) {
      logger.error('Failed to subscribe.', error);
      clearInterval(intervalId);
      return;
    }

    if (!shouldContinue) {
      logger.info('Unsubscribing...');
      clearInterval(intervalId);
      return;
    }

    logger.info('Subscribing to Meta Allocator refresh applications...');

    try {
      const lastBlock = await fetchDatacapLatestUpdateBlock('filecoin-plus', 'applicationDetails');
      const datacapMap = await updateDatacapInfo(
        'filecoin-plus',
        'applicationDetails',
        lastBlock + 1,
      );

      for (let [allocatorAddress, allocatorData] of datacapMap) {
        logger.info(`Checking allocator: ${allocatorAddress}`);
        await submitRefreshMetaAllocatorCommand(
          allocatorAddress,
          allocatorData.datacapInfo,
          config.REFRESH_MIN_THRESHOLD_PCT,
          repository,
          commandBus,
          logger,
        );
      }
    } catch (err) {
      logger.error('subscribeRefreshMetaAllocator uncaught exception', err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_REFRESH_META_ALLOCATOR_POLLING_INTERVAL);

  return () => {
    shouldContinue = false;
  };
}
