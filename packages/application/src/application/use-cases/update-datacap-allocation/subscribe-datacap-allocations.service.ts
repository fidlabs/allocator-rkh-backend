import { ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';

import { ILotusClient } from '@src/infrastructure/clients/lotus';
import { TYPES } from '@src/types';
import { methods as m } from 'filecoin-verifier-tools';
import { UpdateDatacapAllocationCommand } from './update-datacap-allocation';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import config from '@src/config';
import cbor from 'cbor';

const VERIFIED_REGISTRY_ACTOR_ADDRESS = 'f06';

const schema = {
  type: 'hamt',
  key: 'address',
  value: 'bigint',
};
const verSchema = ['address', 'cid', 'cid', 'cid', 'int', 'cid'];

export async function subscribeDatacapAllocations(container: Container) {
  const methods = (await m()).mainnet;

  const lotusClient = container.get<ILotusClient>(TYPES.LotusClient);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const logger = container.get<Logger>(TYPES.Logger);
  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const datacapCache = new Map<string, bigint>();

  logger.info('Subscribing to datacap allocations');
  setInterval(async () => {
    try {
      const head = await lotusClient.getChainHead();
      const actor = await lotusClient.getActor(VERIFIED_REGISTRY_ACTOR_ADDRESS, head.Cids);
      const verRegState = await lotusClient.getChainObj(actor.Head);
      const verRegStateDecoded = cbor.decode(verRegState);
      const verLnks = methods.decode(verSchema, verRegStateDecoded);
      const verifiers = await lotusClient.getChainObj(verLnks[1]);
      const verifiersDecoded = cbor.decode(verifiers);
      const dta = methods.decode(schema, verifiersDecoded);
      for (const it of await dta.asList(async a => {
        if (!a) {
          return ['', []];
        }
        const res = await lotusClient.getChainObj(a);
        return res;
      })) {
        if (datacapCache.get(it[0]) === it[1]) {
          logger.debug(`Datacap allocation for ${it[0]} is up to date`);
          continue;
        }

        const actorId = await lotusClient.getActorId(it[0]);
        const allocator = await applicationDetailsRepository.getByActorId(actorId);
        if (!allocator) {
          logger.warn(`Allocator not found for actor id ${actorId}`);
          continue;
        }

        logger.info(`Updating datacap allocation for ${allocator.id} to ${it[1]}`);
        await commandBus.send(new UpdateDatacapAllocationCommand(allocator.id, it[1]));
        datacapCache.set(it[0], it[1]);
        break;
      }
    } catch (err) {
      logger.error('subscribeDatacapAllocations uncaught exception', err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_DATACAP_ALLOCATIONS_POLLING_INTERVAL);
}
