import { IRepository, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { Db } from 'mongodb';

import { ApplicationDetails } from './application-details.types';
import { TYPES } from '@src/types';
import { ApplicationStatus } from '@src/domain/application/application';

type PaginatedResults<T> = {
  results: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

export interface IApplicationDetailsRepository extends IRepository<ApplicationDetails> {
  update(applicationDetails: Partial<ApplicationDetails>): Promise<void>;

  getPaginated(
    page: number,
    limit: number,
    status: ApplicationStatus[],
    search?: string,
  ): Promise<PaginatedResults<ApplicationDetails>>;

  getAll(): Promise<ApplicationDetails[]>;

  getByActorId(actorId: string): Promise<ApplicationDetails | null>;

  getByAddress(address: string): Promise<ApplicationDetails | null>;

  getByProposalId(proposalId: number): Promise<ApplicationDetails | null>;
}

@injectable()
class ApplicationDetailsRepository implements IRepository<ApplicationDetails> {
  constructor(
    @inject(TYPES.Db) private readonly _db: Db,
    @inject(TYPES.Logger) private readonly _logger: Logger,
  ) {}

  async save(applicationDetails: ApplicationDetails, expectedVersion: number = 0): Promise<void> {
    await this._db
      .collection<ApplicationDetails>('applicationDetails')
      .updateOne(
        { applicationId: applicationDetails.id },
        { $set: applicationDetails },
        { upsert: true },
      );
  }

  async getById(guid: string): Promise<ApplicationDetails> {
    return this._db
      .collection<ApplicationDetails>('applicationDetails')
      .findOne({ applicationId: guid }) as Promise<ApplicationDetails>;
  }

  async update(applicationDetails: Partial<ApplicationDetails>): Promise<void> {
    await this._db
      .collection<ApplicationDetails>('applicationDetails')
      .updateOne(
        { applicationId: applicationDetails.id },
        { $set: applicationDetails },
        { upsert: true },
      );
  }

  async getPaginated(
    page: number,
    limit: number,
    status: ApplicationStatus[],
    search?: string,
  ): Promise<PaginatedResults<ApplicationDetails>> {
    const skip = (page - 1) * limit;
    const filter: any = {};
    const orConditions: any[] = [];

    if (status.length > 0) {
      orConditions.push({
        status: {
          $in: status,
        },
      });
    }

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    if (search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { address: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    const totalCount = await this._db
      .collection<ApplicationDetails>('applicationDetails')
      .countDocuments(filter);
    const applications = await this._db
      .collection<ApplicationDetails>('applicationDetails')
      .find(filter)
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      results: applications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
      },
    };
  }

  async getAll(): Promise<ApplicationDetails[]> {
    return this._db.collection<ApplicationDetails>('applicationDetails').find({}).toArray();
  }

  async getByActorId(actorId: string): Promise<ApplicationDetails | null> {
    return this._db.collection<ApplicationDetails>('applicationDetails').findOne({ actorId });
  }

  async getByAddress(address: string): Promise<ApplicationDetails | null> {
    this._logger.info(`getByAddress ${address}`);
    return this._db.collection<ApplicationDetails>('applicationDetails').findOne({ address });
  }

  async getByProposalId(proposalId: number): Promise<ApplicationDetails | null> {
    this._logger.info(`getByProposalId ${proposalId}`);
    return this._db.collection<ApplicationDetails>('applicationDetails').findOne({
      'rkhPhase.approvalMessageId': proposalId,
    });
  }
}

export { ApplicationDetailsRepository };
