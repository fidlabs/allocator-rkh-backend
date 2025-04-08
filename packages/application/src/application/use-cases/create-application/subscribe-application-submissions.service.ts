import { ICommandBus } from '@filecoin-plus/core'
import { Container } from 'inversify'

import { CreateApplicationCommand } from '@src/application/use-cases/create-application/create-application.command'
import { IAirtableClient } from '@src/infrastructure/clients/airtable'
import { TYPES } from '@src/types'
import config from '@src/config'

const REQUIRED_AIRTABLE_FIELDS = [
  "Name",
  "Organization Name",
  "On-chain address for DC Allocation",
] // TODO: Add required fields

export async function subscribeApplicationSubmissions(container: Container) {
  const airtableClient = container.get<IAirtableClient>(TYPES.AirtableClient)
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus)
  const processedRecords = new Set<string>()

  setInterval(async () => {
    try {
      const newRecords = await airtableClient.getTableRecords()

      for (const record of newRecords) {
        if (shouldProcessRecord(record, processedRecords)) {
          const command = mapRecordToCommand(record)
          await commandBus.send(command)
          processedRecords.add(record.id)
        }
      }
    } catch (error) {
      console.error('Error processing application submissions:', error)
    }
  }, config.SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL)
}

function shouldProcessRecord(record: any, processedRecords: Set<string>): boolean {
  return (
    !processedRecords.has(record.id) &&
    isRecordValid(record) //  && isApplicationNumberInRange(Number(record.fields['Application Number']))
  )
}

function isRecordValid(record: any): boolean {
  return REQUIRED_AIRTABLE_FIELDS.every((field) => field in record.fields)
}

function mapRecordToCommand(record: any): CreateApplicationCommand {
  console.log('record', record)
  return new CreateApplicationCommand({
    applicationId: record.id,
    applicationNumber: record.fields['Application Number'] as number,
    applicantName: record.fields['Name'] as string,
    applicantAddress: record.fields['On-chain address for DC Allocation'] as string,
    applicantOrgName: record.fields['Organization Name'] as string,
    applicantOrgAddresses: [record.fields['Organization On-Chain address'] as string],
    allocationTrancheScheduleType: record.fields['Allocation Tranche Schedule Type'] as string,
    audit: record.fields['Audit'] as string,
    distributionRequired: record.fields['Distribution Required'] as string,
    allocationRequiredStorageProviders: record.fields['Number of Storage Providers required'] as string,
    allocationRequiredReplicas: record.fields['Replicas required, verified by CID checker'] as string,
    datacapAllocationLimits: record.fields['DataCap Allocation Limits'] as string,
    applicantGithubHandle: record.fields['Name'] as string,
    otherGithubHandles: record.fields['Additional GitHub Users'] as string[],
    onChainAddressForDataCapAllocation: record.fields['On-chain address for DC Allocation'] as string,
  })
}

export function mapRecordToCommandTest(record: any): CreateApplicationCommand {
  return mapRecordToCommand(record);
}
