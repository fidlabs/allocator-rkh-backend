import { ICommandBus, Logger } from '@filecoin-plus/core'
import { Container } from 'inversify'

import { ILotusClient } from '@src/infrastructure/clients/lotus'
import { TYPES } from '@src/types'
import { methods as m } from 'filecoin-verifier-tools'
import config from '@src/config'
import { UpdateRKHApprovalsCommand } from './update-rkh-approvals.command'
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository'
import * as address from '@glif/filecoin-address'
import cbor from "cbor";

const RKH_MULTISIG_ACTOR_ADDRESS = 'f080'
const VERIFIED_REGISTRY_ACTOR_METHODS = {
  PROPOSE_ADD_VERIFIER: 2,
  APPROVE_ADD_VERIFIER: 3
}

const getVerifierFromParams = (params: string, logger: Logger): string => {
  const paramsBytes = Uint8Array.from(Buffer.from(params, 'base64'));
  const paramsCbor = cbor.decode(paramsBytes)

  // TODO we should decode this through the methods.decode() function but
  // at time of writing it doesn't cope with F4s so unroll it by hand
  // Should be 2 buffers, first is the address, second is the datacap. If any of that
  // fails we can quietly ignore it
  if (!Array.isArray(paramsCbor) || paramsCbor.length !== 2) {
    logger.debug("Ignoring malformed addVerifier message")
    return ""
  }

  const addressParam = 0

  try {
    logger.debug(`Trying to construct address from ${paramsCbor[addressParam]}`)
    const addr = new address.Address(paramsCbor[addressParam])
    const verifier = address.encode('f', addr)
    return verifier
  } catch (err) {
    logger.debug("Could not extract address from CBOR", paramsCbor)
    return ""
  }
}

const getProposalIdFromParams = (params: string, logger: Logger): number => {
  const paramsBytes = Uint8Array.from(Buffer.from(params, 'base64'));
  const paramsCbor = cbor.decode(paramsBytes)

  const proposalIdParam = 0

  try {
    logger.debug(`Trying to find proposal ID from ${paramsCbor[proposalIdParam]}`)
    return paramsCbor[proposalIdParam]
  } catch (err) {
    logger.debug("Could not extract proposal ID from CBOR", paramsCbor)
    console.log(params)
    console.log(paramsCbor)
    console.log(paramsCbor[proposalIdParam])
    return 0
  }
}

async function findProcessApprovals(
  lotusClient: ILotusClient,
  commandBus: ICommandBus,
  applicationDetailsRepository: IApplicationDetailsRepository,
  methods: any,
  logger: Logger) {
  
  const msigState = await lotusClient.getMultisig(RKH_MULTISIG_ACTOR_ADDRESS)
  logger.debug(`msigState is: ${JSON.stringify(msigState)}`)

  // First do pending ones, to update the m-of-n state
  logger.debug(`Found ${msigState.pendingTxs.length} pending transactions`)
  for (const tx of msigState.pendingTxs) {
    logger.debug(`Processing pending transaction: ${JSON.stringify(tx)}`)

    if (tx.to != config.VERIFIED_REGISTRY_ACTOR_ADDRESS || tx.method != VERIFIED_REGISTRY_ACTOR_METHODS.PROPOSE_ADD_VERIFIER) {
      logger.debug("Skipping irrelevant RKH multisig proposal", tx)
    }

    // Parse the params from the pending tx and extract the verifier address
    let verifier = getVerifierFromParams(tx.params, logger)

    const applicationDetails = await applicationDetailsRepository.getByAddress(verifier)
    if (!applicationDetails) {
      console.log('Application details not found for address', verifier)
      continue
    }
    try {
      await commandBus.send(new UpdateRKHApprovalsCommand(applicationDetails.id, tx.id, tx.approved, "Pending"))
    } catch (error) {
      console.error('Error updating RKH outstanding approvals', { error })
    }
  }

  // Now do recently completed ones
  logger.debug(`Found ${msigState.approvedTxs.length} approved transactions`)
  for (const tx of msigState.approvedTxs) {
    try {
      // If the last person approves rather than adding to the proposal count
      // then what we get doesn't include the actual address or params, it's just
      // an approval on the proposal ID
      const proposal = getProposalIdFromParams(tx.params, logger)
      const applicationDetails = await applicationDetailsRepository.getByProposalId(proposal)
      if (!applicationDetails) {
        console.log('Application details not found for proposal ID', proposal)
        continue
      }
      await commandBus.send(new UpdateRKHApprovalsCommand(applicationDetails.id, 0, [], "Approved"))
    } catch (error) {
      console.error('Error updating RKH completed approvals', { error })
      // swallow and move on to the next one, it's probably just not for us
    }
  }
}

export async function subscribeRKHApprovals(container: Container) {
  const methods = (await m()).mainnet

  const commandBus = container.get<ICommandBus>(TYPES.CommandBus)
  const logger = container.get<Logger>(TYPES.Logger)
  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)
  const lotusClient = container.get<ILotusClient>(TYPES.LotusClient)

  logger.info('Subscribing to RKH proposals')
  setInterval(async () => {
    try{
      await findProcessApprovals(lotusClient, commandBus, applicationDetailsRepository, methods, logger)
    } catch (err) {
      logger.error("subscribeRKHApprovals uncaught exception:", err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL)
}
