import { ICommandBus, Logger } from '@filecoin-plus/core'
import { Container } from 'inversify'
import { TYPES } from '@src/types'
import { UpdateMetaAllocatorApprovalsCommand } from '@src/application/use-cases/update-ma-approvals/update-ma-approvals.command'
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository'
import config from '@src/config'
import { ethers } from 'ethers';
import { MongoClient } from 'mongodb'


const ALLOWANCE_CHANGED_EVENT_ABI = [
  {
    "type":"event",
    "name":"AllowanceChanged",
    "inputs":[
       {
          "name":"allocator",
          "type":"address",
          "indexed":true,
          "internalType":"address"
       },
       {
          "name":"allowanceBefore",
          "type":"uint256",
          "indexed":false,
          "internalType":"uint256"
       },
       {
          "name":"allowanceAfter",
          "type":"uint256",
          "indexed":false,
          "internalType":"uint256"
       }
    ],
    "anonymous":false
 }
]


type Approval = {
  blockNumber: number,
  txHash: string,
  contractAddress: string,
  allocatorAddress: string,
  allowanceBefore: string,
  allowanceAfter: string,
}


export function ensureSubscribeMetaAllocatorApprovalsConfig() {
  const expectedConfigVars = [
    'SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL',
    'VALID_META_ALLOCATOR_ADDRESSES',
    'LOTUS_RPC_URL',
    'MONGODB_URI',
  ]
  for (let configVar of expectedConfigVars) {
    if (!config[configVar]) {
      throw new Error(`Missing config variable: '${configVar}'`)
    }
  }
}


async function fetchApprovals(fromBlock: number): Promise<any[]> {
  console.log(`Fetching approvals from block ${fromBlock}...`)
  const provider = new ethers.providers.JsonRpcProvider(config.EVM_RPC_URL)

  /* Ensure 'fromBlock' is within the allowed lookback range.
     Lotus enforces exactly that “no more than 16h40m” window, which is 2000 epochs.
     Any lookback more than that will be rejected so we have to accept some
     lossiness here if (eg the service goes down for a bit).
     Using 1990 to allow a little headroom for race conditions */
  const head = await provider.getBlockNumber();
  const from = fromBlock > (head - 2000) ? fromBlock : head - 1990;
  console.log(`After adjustment fetching approvals from block ${from}...`)

  const iface = new ethers.utils.Interface(ALLOWANCE_CHANGED_EVENT_ABI)
  const eventTopic = iface.getEventTopic("AllowanceChanged")
  console.log(`Ethers returned topic: ${eventTopic}...`)
  const filter = {
      fromBlock: from,
      toBlock: head,
      topics: [eventTopic]
  }
  let logs: any[]
  try {
    console.log(`Ethers getting logs...`)
    logs = await provider.getLogs(filter);
    console.log(`Ethers returned ${logs.length} logs...`)
    console.log(logs)
  } catch (error) {
    console.log(`Ethers fetch FAILED...`)
    console.error(error)
    return []
  }

  const approvals: Approval[] = []
  for (let log of logs) {
    try {
      console.log(`Processing log ${log.transactionHash}...`)
      console.log(log)
        const decoded = iface.decodeEventLog("AllowanceChanged", log.data, log.topics)
        if (decoded) {
          console.log(`Decoded log ${log.transactionHash} SUCCESS...`)
          console.log(decoded)
          const approval = {
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            contractAddress: log.address,
            allocatorAddress: decoded.allocator,
            allowanceBefore: decoded.allowanceBefore.toString(),
            allowanceAfter: decoded.allowanceAfter.toString(),
          }
          approvals.push(approval)
        } else {
          console.log(`Decoded log ${log.transactionHash} FAILED...`)
        }
    } catch (error) {
      console.log(`Decoding log ${log.transactionHash} ERROR...`)
      continue
    }
  }

  return approvals

}


async function fetchLastBlockMetaAllocator(databaseName: string, collectionName: string): Promise<number> {
  const client = new MongoClient(config.MONGODB_URI)
  try {
      await client.connect()
      const database = client.db(databaseName)
      const collection = database.collection(collectionName)
      const document = await collection.find({ "metaAllocator": { $exists: true } })
          .sort({ "metaAllocator.blockNumber": -1 })
          .limit(1)
          .toArray()

      if (document.length > 0) {
          return document[0].metaAllocator.blockNumber
      } else {
          return -1
      }
  } catch (error) {
      return -1
  } finally {
      await client.close()
  }
}


export async function subscribeMetaAllocatorApprovals(container: Container) {
  const logger = container.get<Logger>(TYPES.Logger)
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus)
  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)

  let shouldContinue = true

  const intervalId = setInterval(async () => {
    try {
      ensureSubscribeMetaAllocatorApprovalsConfig()
    } catch (error) {
      logger.error('Failed to subscribe to MetaAllocator proposals.', error)
      clearInterval(intervalId)
      return
    }

    if (!shouldContinue) {
      logger.info("Unsubscribing from MetaAllocator proposals...")
      clearInterval(intervalId)
      return
    }

    logger.info("Subscribing to MetaAllocator proposals...")

    try {
      let lastBlock = await fetchLastBlockMetaAllocator('filecoin-plus', 'applicationDetails')
      const approvals = await fetchApprovals(lastBlock + 1)
      logger.info(`Found ${approvals.length} AllowanceChanged events since block ${lastBlock + 1}.`)

      for (let approval of approvals) {
        console.log(`Processing approval ${approval.txHash}, approved by ${approval.contractAddress}...`)
        console.log(approval)
        if (config.VALID_META_ALLOCATOR_ADDRESSES.includes(approval.contractAddress)) {
          let actorId = approval.allocatorAddress
          if (actorId.startsWith('0x')) {
            console.log(`Allocator Id is an Ethereum address: ${actorId}`)
            // If the address is an Ethereum address, convert to Filecoin Id first
            const provider = new ethers.providers.JsonRpcProvider(config.EVM_RPC_URL)
            const filecoinId = await provider.send(
              "Filecoin.EthAddressToFilecoinAddress",
              [actorId],
            )
            console.log(`Converted to Filecoin id: ${filecoinId}`)
            if (!filecoinId) {
              logger.error('Failed to convert Ethereum address to Filecoin address:', actorId);
            }
            actorId = filecoinId
          }
          const applicationDetails = await applicationDetailsRepository.getByActorId(actorId)
          if (!applicationDetails) {
            logger.info('Application details not found for address:', actorId)
            continue
          }
          try {
            logger.info("Sending UpdateMetaAllocatorApprovalsCommand...")
            const allocatorId = applicationDetails.id
            const command = new UpdateMetaAllocatorApprovalsCommand(allocatorId, approval.blockNumber, approval.txHash)
            await commandBus.send(command)
          } catch (error) {
            logger.error('Error updating Meta Allocator approvals', error)
          }
        } else {
          logger.debug(`Invalid contract address: ${approval.contractAddress}`)
          logger.debug(config.VALID_META_ALLOCATOR_ADDRESSES)
        }
      }
    } catch (err) {
      logger.error("subscribeMetaAllocatorApprovals uncaught exception", err)
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL)

  return () => {
    shouldContinue = false
  }

}

