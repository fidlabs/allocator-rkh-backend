import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import '@src/api/http/controllers/index.js';
import '@src/api/http/controllers/admin.controller';

import Web3 from 'web3';
import config from '@src/config';
import { MongoClient } from 'mongodb';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { initialize } from '@src/startup';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import {
  subscribeMetaAllocatorApprovals,
  ensureSubscribeMetaAllocatorApprovalsConfig,
} from '@src/application/use-cases/update-ma-approvals/subscribe-ma-approvals.service';

const web3 = new Web3(config.LOTUS_RPC_URL);

async function fetchApplicationDocumentByAddressMany(
  address: string,
  databaseName: string,
  collectionName: string,
) {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const documents = await collection.find({ address: address }).toArray();
    if (documents.length > 0) {
      return documents;
    } else {
      console.log('No documents found with the specified address.');
    }
  } catch (error) {
    console.error('Error accessing MongoDB collection:', error);
  } finally {
    await client.close();
  }
}

async function deleteDocumentByIdMany(ids: any, databaseName: string, collectionName: string) {
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const result = await collection.deleteMany({ _id: { $in: ids } });
    console.log(`Documents deleted: ${result.deletedCount}`);
  } catch (error) {
    console.error('Error deleting documents:', error);
  } finally {
    await client.close();
  }
}

async function removeDuplicates(address: string, databaseName: string, collectionName: string) {
  /** Multiple documents with same 'address' not allowed. */
  const client = new MongoClient(config.MONGODB_URI);
  try {
    await client.connect();
    const documents: any = await fetchApplicationDocumentByAddressMany(
      address,
      databaseName,
      collectionName,
    );
    if (documents.length > 1) {
      const maxPullRequestNumber = Math.max(
        ...documents.map((doc: any) => doc.applicationDetails.pullRequestNumber),
      );
      const idsToDelete = documents
        .filter((doc: any) => doc.applicationDetails.pullRequestNumber !== maxPullRequestNumber)
        .map((doc: any) => doc._id);
      await deleteDocumentByIdMany(idsToDelete, databaseName, collectionName);
    } else {
      console.log('No duplicates found.');
    }
  } catch (error) {
    console.error('Error processing duplicates:', error);
  } finally {
    await client.close();
  }
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

async function metaAllocatorApprovalTest(
  container: Container,
  allocatorAddress: string,
  allocatorPrivateKey: string,
  contractAddress: string,
) {
  await removeDuplicates(allocatorAddress, 'filecoin-plus', 'applicationDetails');

  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const applicationDetails: any = await applicationDetailsRepository.getByAddress(allocatorAddress);
  const lastBlock = applicationDetails.metaAllocator?.blockNumber || -1;
  console.log('Last block:', lastBlock);

  console.log('applicationDetails before: ', applicationDetails);
  const unsubscribe = await subscribeMetaAllocatorApprovals(container);

  const txHash = await simulateAddAllowance(
    allocatorAddress,
    allocatorPrivateKey,
    contractAddress,
    10,
  );
  console.log('Simulated addAllowance txHash:', txHash);

  try {
    while (true) {
      const applicationDetails: any =
        await applicationDetailsRepository.getByAddress(allocatorAddress);
      if (applicationDetails && 'metaAllocator' in applicationDetails) {
        const currBlock = applicationDetails.metaAllocator.blockNumber || -1;
        if (currBlock > lastBlock) {
          console.log('applicationDetails after: ', applicationDetails);
          unsubscribe();
          break;
        }
      } else {
        console.log('Document not found or missing metaAllocator, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function main() {
  /*
    NOTE: 
    1. Ensure meta allocator contract is deployed
    2. Ensure application is created (use create-app.ts)

    Expected output:

    1. MongoDB 'applicationDetails' update.

    status: ApplicationStatus.APPROVED,
    metaAllocator: {
        blockNumber: event.blockNumber,
        txHash: event.txHash,
    }

    2. PR approved and merged
    */

  const META_ALLOCATOR_CONTRACT_ADDRESS = '0x15A9D9b81E3c67b95Ffedfb4416D25a113C8c6df';
  const ALLOCATOR_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // deployer
  const ALLOCATOR_PRIVATE_KEY =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  ensureSubscribeMetaAllocatorApprovalsConfig();
  if (!config.VALID_META_ALLOCATOR_ADDRESSES.includes(META_ALLOCATOR_CONTRACT_ADDRESS)) {
    console.error('Provided META_ALLOCATOR_CONTRACT_ADDRESS is invalid.');
    return;
  }

  console.log('Configured environment variables:');
  const expectedConfigVars = [
    'SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL',
    'VALID_META_ALLOCATOR_ADDRESSES',
    'LOTUS_RPC_URL',
    'MONGODB_URI',
  ];
  for (const key of expectedConfigVars) {
    console.log(key, config[key]);
  }

  console.log('Testing application creation...');
  const container = await initialize();

  await metaAllocatorApprovalTest(
    container,
    ALLOCATOR_ADDRESS,
    ALLOCATOR_PRIVATE_KEY,
    META_ALLOCATOR_CONTRACT_ADDRESS,
  );
}

main();
