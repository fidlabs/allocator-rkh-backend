import { Logger } from '@filecoin-plus/core';
import Airtable, { Records } from 'airtable';
import { inject, injectable } from 'inversify';
import { Collection } from 'mongodb';

import { TYPES } from '@src/types';

/**
 * Represents an Airtable record.
 */
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

/**
 * Interface for the Airtable client.
 */
export interface IAirtableClient {
  /**
   * Retrieves records from the Airtable.
   * @returns A promise that resolves to an array of AirtableRecords.
   */
  getTableRecords(): Promise<AirtableRecord[]>;
}

/**
 * Configuration options for AirtableClient.
 */
export interface AirtableClientConfig {
  apiKey: string;
  baseId: string;
  tableName: string;
}

/**
 * Implements the IAirtableClient interface to interact with Airtable.
 */
@injectable()
export class AirtableClient implements IAirtableClient {
  private readonly base: Airtable.Base;
  private readonly recordsCollection: Collection;

  /**
   * Constructs a new AirtableClient instance.
   * @param config The configuration options for the Airtable client.
   */
  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.AirtableClientConfig)
    private readonly config: AirtableClientConfig,
  ) {
    this.base = new Airtable({ apiKey: config.apiKey }).base(config.baseId);
  }

  /**
   * Retrieves records from the Airtable.
   * @returns A promise that resolves to an array of AirtableRecords.
   * @throws Error if there's an issue fetching records from Airtable.
   */
  async getTableRecords(): Promise<AirtableRecord[]> {
    const table = this.base(this.config.tableName);

    try {
      const records = await this.fetchRecordsFromAirtable(table);
      if (records.length === 0) {
        return [];
      }
      return this.mapAirtableRecords(records);
    } catch (error) {
      this.logger.error('Error fetching records from Airtable:', error);
      throw new Error('Failed to fetch records from Airtable');
    }
  }

  /**
   * Fetches records from Airtable.
   * @param table The Airtable table to fetch records from.
   * @returns An array of fetched Airtable records.
   */
  private async fetchRecordsFromAirtable(table: Airtable.Table<any>): Promise<Records<any>> {
    this.logger.info('Fetching records from Airtable');
    const records = await table.select().all();
    this.logger.info(`Fetched ${records.length} records from Airtable`);
    return records;
  }

  /**
   * Maps Airtable records to the AirtableRecord interface format.
   * @param records The Airtable records to map.
   * @returns An array of mapped AirtableRecord objects.
   */
  private mapAirtableRecords(records: Records<any>): AirtableRecord[] {
    return records.map(record => ({
      id: record.id,
      fields: record._rawJson.fields,
    }));
  }
}
