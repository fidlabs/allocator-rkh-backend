import { ethers } from 'ethers';
import { Container } from 'inversify';

import { ICommandBus, Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import config from '@src/config';
import { ApplicationStatus } from '@src/domain/application/application';
import { CreateRefreshApplicationCommand } from '../create-application/create-refresh-application.command';

const META_ALLOCATOR_CONTRACT_ABI = [
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

export async function subscribeMetaAllocatorAllowances(container: Container) {
  const logger = container.get<Logger>(TYPES.Logger);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const repository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const datacapCache = new Map<string, bigint>();

  logger.info('Subscribing to Meta Allocator allowances...');

  setInterval(async () => {
    try {
      const approvedAllocators = await repository.getPaginated(1, 1000, [
        ApplicationStatus.DC_ALLOCATED,
      ]);
      const allocators = approvedAllocators.results.filter(
        a =>
          a.applicationInstructions &&
          a.applicationInstructions[a.applicationInstructions.length - 1].method !== 'RKH',
      );
      console.log('Found', allocators.length, 'allocators');

      for (const allocator of allocators) {
        const currentDatacap = await fetchCurrentDatacap(allocator.address);
        if (datacapCache.get(allocator.address) === currentDatacap) {
          logger.debug(`Datacap for ${allocator.address} is up to date`);
          continue;
        }

        if (!allocator.applicationInstructions) {
          logger.debug(`No applicationInstructions found for allocator: ${allocator.address}`);
          continue;
        }

        try {
          const initialDatacap =
            allocator.applicationInstructions[allocator.applicationInstructions.length - 1]
              .datacap_amount;
          logger.debug(`Current Datacap: ${currentDatacap}, Initial Datacap: ${initialDatacap}`);
          const pct = (Number(currentDatacap) / Number(initialDatacap)) * 100;
          if (pct <= config.REFRESH_MIN_THRESHOLD_PCT) {
            const applicationId = allocator.id;
            const command = new CreateRefreshApplicationCommand(applicationId);
            await commandBus.send(command);
          }
        } catch (error) {
          logger.error(`Error refreshing application for allocator: ${allocator.address}`, {
            error,
          });
        }
        datacapCache.set(allocator.address, currentDatacap);
      }
    } catch (err) {
      logger.error('subscribeMetaAllocatorAllowances uncaught exception', err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_REFRESH_META_ALLOCATOR_POLLING_INTERVAL);
}

async function fetchCurrentDatacap(allocatorAddress: string): Promise<bigint> {
  const provider = new ethers.providers.JsonRpcProvider(config.EVM_RPC_URL);
  const contract = new ethers.Contract(
    config.META_ALLOCATOR_CONTRACT_ADDRESS,
    META_ALLOCATOR_CONTRACT_ABI,
    provider,
  );
  const allowance = await contract.allowance(allocatorAddress);
  const allowanceNumber = allowance.toNumber();
  return allowanceNumber;
}
