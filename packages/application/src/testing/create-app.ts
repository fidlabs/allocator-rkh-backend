import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import '@src/api/http/controllers/index.js';
import '@src/api/http/controllers/admin.controller';

import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { ICommandBus } from '@filecoin-plus/core';
import { mapRecordToCommandTest } from '@src/application/use-cases/create-application/subscribe-application-submissions.service';
import { initialize } from '@src/startup';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import { MongoClient } from 'mongodb';

const MONGO_URI =
  'mongodb+srv://filecoin-plus:m6CEYieBTc0Y7kLs@ragnarokdemocluster.4zqzb.mongodb.net';
const APPLICANT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function fetchApplicationDocumentById(
  applicationId: string,
  databaseName: string,
  collectionName: string,
) {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    const document = await collection.findOne({ applicationId: applicationId });
    if (document) {
      return document;
    } else {
      console.log('No document found with the specified applicationId.');
    }
  } catch (error) {
    console.error('Error accessing MongoDB collection:', error);
  } finally {
    await client.close();
  }
}

export async function createApplicationTest(
  container: Container,
  applicationId: string,
  verbose = true,
) {
  const sampleRecord: any = {
    id: applicationId,
    fields: {
      'Application Number': 1001,
      'Allocator Pathway Name': 'John Doe',
      'Region of Operation': 'North America',
      'GitHub ID': 'john-doe-gh',
      'Slack ID': '@john-doe',
      'Multisig Address': APPLICANT_ADDRESS, // Becomes 'address'
      'Organization Name': 'Doe Inc.',
      'Organization On-Chain address': '0xabcdef1234567890',
      'Type Of Allocator': 'Primary',
      '7. DataCap requested for allocator for 12 months of activity': 5000,
      'Target Clients': ['Client1', 'Client2'],
      'Type of data': ['TypeA', 'TypeB'],
      'Replicas required, verified by CID checker': '3',
      'Number of Storage Providers required': '10',
      'Standardized DataCap Schedule - First Allocation (TiB):': 100,
      'Standardized DataCap Schedule - Second Allocation (TiB):': 200,
      'Standardized DataCap Schedule - Third Allocation (TiB):': 300,
      'Standardized DataCap Schedule - Fourth Allocation (TiB):': 400,
      'GitHub Bookkeeping Repo Link': 'https://github.com/john-doe/bookkeeping',
    },
  };
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const command = mapRecordToCommandTest(sampleRecord);
  await commandBus.send(command);
  if (verbose) {
    console.log('Generated CreateApplicationCommand:', command);
  }
}

async function fetchApplicationByAddress(address: string, container: Container) {
  console.log('Fetching application by address from database...');
  const applicationRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const application = await applicationRepository.getByAddress(address);
  return application;
}

async function main() {
  /*
    Expected output:

    1. PR Application JSON the following is added:

    "application_instructions": []

    2. Database is updated with 'address' equals to 'APPLICANT_ADDRESS'
    3. Database is updated with:

    applicationInstructions: []
    */

  const container = await initialize();

  console.log('Testing application creation...');
  const timestamp = Math.floor(Date.now() / 1000);
  const applicationId = `app-test-${timestamp}`;
  await createApplicationTest(container, applicationId);

  // const applicationId = 'app-test-1730107971'
  console.log(`Fetching application ${applicationId} from MongoDB...`);
  const application = await fetchApplicationDocumentById(
    applicationId,
    'filecoin-plus',
    'applicationDetails',
  );
  // const application = await fetchApplicationByAddress(APPLICANT_ADDRESS, container)
  console.log(application);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
