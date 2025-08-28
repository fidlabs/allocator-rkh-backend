import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';

import { ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';

import { TYPES } from '@src/types';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import {
  fetchCurrentDatacapCache,
  submitRefreshRKHAllocatorCommand,
} from '@src/application/use-cases/refresh-rkh-datacap/subscribe-refresh-rkh.service';
import { createApplicationTest } from './create-app';
import {
  ApplicationStatus,
  DatacapAllocator,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { AllocatorType } from '@src/domain/types';
import { initialize } from '@src/startup';
import { MongoClient } from 'mongodb';
import config from '@src/config';

async function deleteByAddressAll(address: string, databaseName: string, collectionName: string) {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const result = await collection.deleteMany({ address: address });
    console.log(`Documents deleted: ${result.deletedCount}`);
  } catch (error) {
    console.error('Error deleting documents:', error);
  } finally {
    await client.close();
  }
}

async function testSubmitRefreshRKHAllocatorCommand(
  actorId: string,
  currentDatacap: bigint,
  container: Container,
) {
  const allocatorAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  const currentDatacapCache = new Map<string, bigint>();
  currentDatacapCache.set(actorId, currentDatacap);

  const logger = container.get<Logger>(TYPES.Logger);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const repository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );

  // Ensure currentDatacap is below the minimum threshold:
  const initialDatacap = (100 / config.REFRESH_MIN_THRESHOLD_PCT) * Number(currentDatacap);
  // await deleteByAddressAll(allocatorAddress, 'filecoin-plus', 'applicationDetails')

  // Ensure the following:
  // - applicationStatus is 'APPROVED'
  // - 'applicationInstruction' is present
  // - 'actorId' is present
  await repository.update({
    id: allocatorAddress,
    actorId: actorId,
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
        method: AllocatorType.RKH,
      },
    ],
  });

  const allocatorRepository = container.get<IDatacapAllocatorRepository>(
    TYPES.DatacapAllocatorRepository,
  );

  // Ensure allocator exists in DatacapAllocatorRepository:
  try {
    await allocatorRepository.getById(allocatorAddress);
  } catch (error) {
    await createApplicationTest(container, allocatorAddress);
    const allocator = await allocatorRepository.getById(allocatorAddress);
    console.log('Created new allocator with ID: ', allocator.guid);
  }

  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const applications = await applicationDetailsRepository.getAll();

  for (const applicationDetails of applications) {
    if (applicationDetails.actorId !== actorId) {
      continue;
    }
    await submitRefreshRKHAllocatorCommand(
      applicationDetails,
      currentDatacapCache,
      config.REFRESH_MIN_THRESHOLD_PCT,
      commandBus,
      logger,
    );
    break;
  }
}

async function testFetchCurrentDatacapCache(container: Container) {
  // NOTE: When testing use: https://api.node.glif.io/rpc/v1
  const currentDatacapCache = await fetchCurrentDatacapCache(container);
  currentDatacapCache.forEach((value, key) => {
    console.log(`actorId: ${key}, datacap: ${value}`);
  });
}

async function main() {
  /*
    NOTE: submitRefreshRKHAllocatorCommand depends on fetchCurrentDatacapCache however we test
    fetchCurrentDatacapCache independently. 

    Functions to test:
    1. fetchCurrentDatacapCache: DONE
       - Copied from 'subscribe-datacap-allocation.service.ts'. Assumed correct.
    2. submitRefreshRKHAllocatorCommand DONE
    */

  const container = await initialize();
  await testFetchCurrentDatacapCache(container);

  const actorId = 't03019924';
  const currentDatacap = BigInt(5629499534213120);
  await testSubmitRefreshRKHAllocatorCommand(actorId, currentDatacap, container);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
