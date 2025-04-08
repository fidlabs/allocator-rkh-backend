import { ICommandBus, Logger } from '@filecoin-plus/core'
import { VerifyAPI, methods as m } from '@keyko-io/filecoin-verifier-tools'
import { Container } from 'inversify'

import { TYPES } from '@src/types'
import config from '@src/config'
import { UpdateRKHApprovalsCommand } from './update-rkh-approvals.command'
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository'
import { ILotusClient } from '@src/infrastructure/clients/lotus'

import cbor from "cbor";

const RHK_MULTISIG_ACTOR_ADDRESS = 'f080'
const VERIFIED_REGISTRY_ACTOR_METHODS = {
  ADD_VERIFIER: 2,
}

const methods = m.mainnet
const schema = {
  type: "hamt",
  key: "bigint-key",
  value: {
      to: "address",
      value: "bigint",
      method: "int",
      params: "buffer",
      signers: ["list", "address"],
  },
}

const verSchema = [
  ["cid"],           // Array of hexadecimal strings
  "int",             // Integer (example: 2)
  "int",             // Integer (example: 755)
  "string",          // String (empty in your example)
  "int",             // Integer (flag/status, example: 0)
  "int",             // Integer (flag/status, example: 0)
  {
      "value": "cid", // Long hexadecimal string
      "tag": "int"    // Integer (identifier or descriptor, example: 42)
  }
]

export async function subscribeRKHApprovals(container: Container) {
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus)
  const logger = container.get<Logger>(TYPES.Logger)
  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)

  // TODO: Refactor this into the lotus client.
  const lotusClient = container.get<ILotusClient>(TYPES.LotusClient)
  const api = new VerifyAPI(
    VerifyAPI.standAloneProvider(config.LOTUS_RPC_URL, {
      token: async () => {
        return config.LOTUS_AUTH_TOKEN
      },
    }),
    {},
    true, // if node != Mainnet => testnet = true
  )

  logger.info('Subscribing to RKH proposals')
  setInterval(async () => {
    logger.info('Checking for pending RKH transactions')
    const head = await lotusClient.getChainHead()
    console.log('Head', head)
    const actor = await lotusClient.getActor(RHK_MULTISIG_ACTOR_ADDRESS, head.Cids)
    console.log('Actor', actor)
    const state = await lotusClient.getChainObj(actor.Head)
    console.log('State', state)
    console.log('State C', await cbor.decode(state))
    /*const data = methods.decode([
      "cbor",
      [["list", "address"],
      "int",
      "int",
      "bigint",
      "int",
      "int",
      "cid"]
    ], state)
    console.log('Data', data)*/
    // return (await this.client.chainGetNode(`${state}/1/@Ha:${addr}/${path}`)).Obj

    const pendingTxs = (await api.pendingTransactions(RHK_MULTISIG_ACTOR_ADDRESS))?.filter(
      (tx: any) =>
        tx?.tx.to == config.VERIFIED_REGISTRY_ACTOR_ADDRESS && tx?.tx.method == VERIFIED_REGISTRY_ACTOR_METHODS.ADD_VERIFIER,
    )
    logger.info(`Found ${pendingTxs.length} pending transactions`)

    for (const tx of pendingTxs) {
      const applicationDetails = await applicationDetailsRepository.getByAddress(tx.parsed.params.verifier)
      if (!applicationDetails) {
        console.log('Application details not found for address', tx.parsed.params.verifier)
        continue
      }
      try {
        await commandBus.send(new UpdateRKHApprovalsCommand(applicationDetails.id, tx.id, tx.tx.signers))
      
      } catch (error) {
        console.error('Error updating RKH approvals', { error })
        }
      }
  }, config.SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL)
}
