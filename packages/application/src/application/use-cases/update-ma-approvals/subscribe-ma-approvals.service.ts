// FIXME create a proper injectable service for this file
import { Command, ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { UpdateMetaAllocatorApprovalsCommand } from '@src/application/use-cases/update-ma-approvals/update-ma-approvals.command';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import config from '@src/config';
import { ethers } from 'ethers';
import { MongoClient } from 'mongodb';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { ApproveRefreshByMaCommand } from '@src/application/use-cases/update-ma-approvals/approve-refresh-by-ma.command';
import { executeWithFallback } from '@src/patterns/execution/executeWithFallback';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';

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

type Approval = {
  blockNumber: number;
  txHash: string;
  contractAddress: string;
  allocatorAddress: string;
  allowanceBefore: string;
  allowanceAfter: string;
};

export function ensureSubscribeMetaAllocatorApprovalsConfig() {
  const expectedConfigVars = [
    'SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL',
    'VALID_META_ALLOCATOR_ADDRESSES',
    'LOTUS_RPC_URL',
    'MONGODB_URI',
  ];

  const missingVars = expectedConfigVars.filter(configVar => !config[configVar]);

  if (missingVars.length > 0) {
    throw new Error(`Missing config variables: ${missingVars.join(', ')}`);
  }
}

async function fetchApprovals(
  fromBlock: number,
  logger: Logger,
  rpcProvider: IRpcProvider,
): Promise<Approval[]> {
  logger.info(`Fetching approvals from block ${fromBlock}...`);
  /* Ensure 'fromBlock' is within the allowed lookback range.
     Lotus enforces exactly that “no more than 16h40m” window, which is 2000 epochs.
     Any lookback more than that will be rejected so we have to accept some
     lossiness here if (eg the service goes down for a bit).
     Using 1990 to allow a little headroom for race conditions */
  const head = await rpcProvider.getBlockNumber();
  logger.info(`Head block is ${head}.`);
  const from = fromBlock > head - 2000 ? fromBlock : head - 1990;
  logger.info(`After adjustment fetching approvals from block ${from}...`);

  const iface = new ethers.utils.Interface(ALLOWANCE_CHANGED_EVENT_ABI);
  const eventTopic = iface.getEventTopic('AllowanceChanged');

  const filter = {
    fromBlock: from,
    toBlock: head,
    topics: [eventTopic],
  };

  let logs: ethers.providers.Log[];
  try {
    logs = await rpcProvider.getLogs(filter);
    logger.info(`Ethers returned ${logs.length} logs...`);
  } catch (error) {
    logger.info(`Ethers fetch FAILED...`);
    logger.error(error);
    return [];
  }

  const approvals: Approval[] = [];
  for (let log of logs) {
    try {
      logger.info(`Processing log ${log.transactionHash}...`);
      logger.info(log);
      const decoded = iface.decodeEventLog('AllowanceChanged', log.data, log.topics);
      if (decoded) {
        logger.info(`Decoded log ${log.transactionHash} SUCCESS...`);
        logger.info(decoded);
        const approval = {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          contractAddress: log.address,
          allocatorAddress: decoded.allocator,
          allowanceBefore: decoded.allowanceBefore.toString(),
          allowanceAfter: decoded.allowanceAfter.toString(),
        };
        approvals.push(approval);
      } else {
        logger.info(`Decoded log ${log.transactionHash} FAILED...`);
      }
    } catch (error) {
      logger.info(`Decoding log ${log.transactionHash} ERROR...`);
    }
  }

  logger.info(`Found ${approvals.length} AllowanceChanged events...`);
  logger.info(approvals);
  return approvals;
}

async function fetchLastBlockMetaAllocator(
  databaseName: string,
  collectionName: string,
  logger: Logger,
): Promise<number> {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const document = await collection.findOne(
      { metaAllocator: { $exists: true } },
      { sort: { 'metaAllocator.blockNumber': -1 } },
    );

    if (!document) throw new Error('Document not found');

    return document.metaAllocator.blockNumber;
  } catch (error) {
    logger.error(`Error fetching last block meta allocator: ${error}`);
    logger.info('Returning -1 as default block value');
    return -1;
  } finally {
    await client.close();
  }
}

//FIXME move it to services
export async function subscribeMetaAllocatorApprovals(container: Container) {
  const logger = container.get<Logger>(TYPES.Logger);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const issuesRepository = container.get<IIssueDetailsRepository>(TYPES.IssueDetailsRepository);
  const rpcProvider = container.get<IRpcProvider>(TYPES.RpcProvider);

  try {
    ensureSubscribeMetaAllocatorApprovalsConfig();
  } catch (error) {
    logger.error('Failed to subscribe to MetaAllocator proposals.', error);
    return;
  }

  let shouldContinue = true;

  const intervalId = setInterval(async () => {
    if (!shouldContinue) {
      logger.info('Unsubscribing from MetaAllocator proposals...');
      clearInterval(intervalId);
      return;
    }

    logger.info('Subscribing to MetaAllocator proposals...');

    try {
      logger.info('Fetching lastBlock...');

      const [applicationLastBlock, issueLastBlock] = await Promise.all([
        fetchLastBlockMetaAllocator('filecoin-plus', 'applicationDetails', logger),
        fetchLastBlockMetaAllocator('filecoin-plus', 'issueDetails', logger),
      ]);
      const lastBlock = Math.max(applicationLastBlock, issueLastBlock);
      logger.info(`Last block is ${lastBlock}.`);
      logger.info('Fetching approvals...');

      const approvals = await fetchApprovals(lastBlock + 1, logger, rpcProvider);
      logger.info(
        `Found ${approvals.length} AllowanceChanged events since block ${lastBlock + 1}.`,
      );

      await Promise.allSettled(
        approvals.map(approval =>
          handleApproval({
            approval,
            logger,
            rpcProvider,
            applicationDetailsRepository,
            issuesRepository,
            commandBus,
          }),
        ),
      );
    } catch (err) {
      logger.error('subscribeMetaAllocatorApprovals uncaught exception', err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL);

  return () => {
    shouldContinue = false;
  };
}

export async function handleApproval({
  approval,
  logger,
  rpcProvider,
  issuesRepository,
  applicationDetailsRepository,
  commandBus,
}: {
  approval: Approval;
  logger: Logger;
  rpcProvider: IRpcProvider;
  issuesRepository: IIssueDetailsRepository;
  applicationDetailsRepository: IApplicationDetailsRepository;
  commandBus: ICommandBus;
}) {
  logger.info(`Processing approval ${approval.txHash}, approved by ${approval.contractAddress}...`);

  if (!config.VALID_META_ALLOCATOR_ADDRESSES.includes(approval.contractAddress.toLowerCase())) {
    logger.debug(`Invalid contract address: ${approval.contractAddress}`);
    logger.debug(config.VALID_META_ALLOCATOR_ADDRESSES);
    return;
  }

  const actorId = await convertToActorId({
    allocatorAddress: approval.allocatorAddress,
    logger,
    rpcProvider,
  });

  if (!actorId) {
    logger.error('Failed to convert Ethereum address to Filecoin address:', actorId);
    return;
  }

  try {
    await executeWithFallback<Command>({
      primary: () =>
        handleMetaAllocatorIssueApproval({
          approval,
          actorId,
          issuesRepository,
        }),
      fallback: () =>
        handleMetaAllocatorApplicationApproval({
          approval,
          actorId,
          applicationDetailsRepository,
        }),
      onPrimaryError: error =>
        logger.error('Error updating Issue MetaAllocator approval, trying Application:', error),
      onFallbackError: error => logger.error('Both Issue and Application handlers failed:', error),
      onSuccess: command => commandBus.send(command),
    });

    logger.info(`Successfully processed MetaAllocator approval for actorId: ${actorId}`);
  } catch (error) {
    logger.error('Error updating Meta Allocator approvals', error);
  }
}

export async function convertToActorId({
  allocatorAddress,
  logger,
  rpcProvider,
}: {
  allocatorAddress: string;
  logger: Logger;
  rpcProvider: IRpcProvider;
}) {
  if (allocatorAddress.startsWith('0x')) {
    logger.info(
      `Allocator Id is an Ethereum address: ${allocatorAddress} converting to Filecoin Id`,
    );
    const filecoinId = await rpcProvider.send<string>('Filecoin.EthAddressToFilecoinAddress', [
      allocatorAddress,
    ]);
    logger.info(`Converted to Filecoin id: ${filecoinId}`);

    return filecoinId;
  }

  return allocatorAddress;
}

export async function handleMetaAllocatorIssueApproval({
  approval,
  actorId,
  issuesRepository,
}: {
  approval: Approval;
  actorId: string;
  issuesRepository: IIssueDetailsRepository;
}) {
  const issue = await issuesRepository.findPendingBy({ actorId });
  if (!issue) throw new Error(`Issue not found for actorId ${actorId}`);

  return new ApproveRefreshByMaCommand(issue, approval);
}

export async function handleMetaAllocatorApplicationApproval({
  approval,
  actorId,
  applicationDetailsRepository,
}: {
  approval: Approval;
  actorId: string;
  applicationDetailsRepository: IApplicationDetailsRepository;
}) {
  const applicationDetails = await applicationDetailsRepository.getPendingBy('actorId', actorId);
  if (!applicationDetails) throw new Error(`Application details not found for actorId ${actorId}`);

  return new UpdateMetaAllocatorApprovalsCommand(
    applicationDetails.id,
    approval.blockNumber,
    approval.txHash,
  );
}
