import { ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';

import { CreateApplicationCommand } from '@src/application/use-cases/create-application/create-application.command';
import { IAirtableClient } from '@src/infrastructure/clients/airtable';
import { TYPES } from '@src/types';
import config from '@src/config';

const REQUIRED_AIRTABLE_FIELDS = [
  'Allocator Pathway Name',
  'Organization Name',
  'On-chain address for DC Allocation',
]; // TODO: Add required fields

export async function subscribeApplicationSubmissions(
  container: Container,
): Promise<NodeJS.Timeout> {
  const logger = container.get<Logger>(TYPES.Logger);

  // Uncomment if you want to do the first pass immediately
  // await processRecords(container)

  // And now poll for updates periodically
  logger.info(`Start loop (${config.SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL})`);
  const interval = setInterval(async () => {
    try {
      await processRecords(container);
    } catch (err) {
      logger.error('subscribeApplicationSubmissions uncaught exception', err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL);

  return interval;
}

async function processRecords(container: Container) {
  const airtableClient = container.get<IAirtableClient>(TYPES.AirtableClient);
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const processedRecords = new Set<string>();
  const logger = container.get<Logger>(TYPES.Logger);

  try {
    const newRecords = await airtableClient.getTableRecords();
    logger.debug(`Fetched ${newRecords.length} records from Airtable`);

    for (const record of newRecords) {
      if (shouldProcessRecord(record, processedRecords)) {
        logger.debug(`Processing record ${record.id}...`, record);

        const command = mapRecordToCommand(record);
        processedRecords.add(record.id);
        logger.debug(`Finalising record ${record.id}...`);
        const resultCommand = await commandBus.send(command);
        if (resultCommand.success) {
          logger.info(`Record ${record.id} processed successfully`);
        } else {
          logger.error(`Record ${record.id} processed with error: ${resultCommand.error}`);
        }
      } else {
        logger.info(`Skipping record ${record.id}...`);
        logger.debug(record);
      }
    }
  } catch (error) {
    processedRecords.clear();
    logger.error('Error processing application submissions:');
    logger.error(error);
  }
}

function shouldProcessRecord(record: any, processedRecords: Set<string>): boolean {
  const alreadyDone = processedRecords.has(record.id);
  const isValid = isRecordValid(record);

  return (
    !alreadyDone && isValid //  && isApplicationNumberInRange(Number(record.fields['Application Number']))
  );
}

function isRecordValid(record: any): boolean {
  return REQUIRED_AIRTABLE_FIELDS.every(field => field in record.fields);
}

function mapRecordToCommand(record: any): CreateApplicationCommand {
  return new CreateApplicationCommand({
    applicationId: record.id,
    applicationNumber: record.fields['Application Number'] as number,
    applicantName: record.fields['Allocator Pathway Name'] as string,
    applicantAddress: record.fields['On-chain address for DC Allocation'] as string,
    applicantOrgName: record.fields['Organization Name'] as string,
    applicantOrgAddresses: record.fields['Organization On-Chain address'] as string,
    allocationTrancheSchedule: record.fields['Allocation Tranche Schedule Type'] as string,
    bookkeepingRepo: record.fields['GitHub Bookkeeping Repo Link'] as string,
    allocationAudit: record.fields['Audit'] as string,
    allocationDistributionRequired: record.fields['Distribution Required'] as string,
    allocationRequiredStorageProviders: record.fields[
      'Number of Storage Providers required'
    ] as string,
    allocationRequiredReplicas: record.fields[
      'Replicas required, verified by CID checker'
    ] as string,
    datacapAllocationLimits: record.fields['DataCap Allocation Limits'] as string,
    applicantGithubHandle: record.fields['Github User ID'] as string,
    otherGithubHandles: record.fields['Additional GitHub Users'] as string,
    onChainAddressForDataCapAllocation: record.fields[
      'On-chain address for DC Allocation'
    ] as string,
  });
}

export function mapRecordToCommandTest(record: any): CreateApplicationCommand {
  return mapRecordToCommand(record);
}
