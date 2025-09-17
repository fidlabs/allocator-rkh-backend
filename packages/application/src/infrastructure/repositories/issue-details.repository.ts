import { IRepository } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { BulkWriteResult, Db, Filter, UpdateFilter, WithId } from 'mongodb';
import { TYPES } from '@src/types';
import { AuditOutcome, IssueDetails } from '@src/infrastructure/repositories/issue-details';

type PaginatedResults<T> = {
  results: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

export interface IIssueDetailsRepository extends IRepository<IssueDetails> {
  update(issueDetails: Partial<IssueDetails>): Promise<void>;

  getPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Promise<PaginatedResults<IssueDetails>>;

  getAll(): Promise<IssueDetails[]>;

  getById(guid: string): Promise<IssueDetails>;

  save(issueDetails: IssueDetails): Promise<void>;

  bulkUpsertByField(
    issues: IssueDetails[],
    identifyingField: keyof IssueDetails,
  ): Promise<BulkWriteResult>;

  findPendingBy(filter: Filter<IssueDetails>): Promise<IssueDetails | null>;

  findSignedBy(filter: Filter<IssueDetails>): Promise<IssueDetails | null>;

  findApprovedBy(filter: Filter<IssueDetails>): Promise<IssueDetails | null>;

  findBy<K extends keyof IssueDetails>(
    key: K,
    value: IssueDetails[K],
  ): Promise<WithId<IssueDetails> | null>;

  findWithLatestAuditBy<K extends keyof IssueDetails>(
    key: K,
    value: IssueDetails[K],
  ): Promise<WithId<IssueDetails> | null>;
}

@injectable()
class IssueDetailsRepository implements IIssueDetailsRepository {
  constructor(@inject(TYPES.Db) private readonly _db: Db) {}

  async getById(guid: string): Promise<IssueDetails> {
    return this._db
      .collection<IssueDetails>('issueDetails')
      .findOne({ applicationId: guid }) as Promise<IssueDetails>;
  }

  async save(issueDetails: IssueDetails): Promise<void> {
    const { refreshStatus } = issueDetails;

    const updateFilter: UpdateFilter<IssueDetails> = {
      $set: issueDetails,
      ...(!refreshStatus
        ? {
            $setOnInsert: {
              refreshStatus: 'PENDING' as const,
            },
          }
        : {}),
    };

    await this._db
      .collection<IssueDetails>('issueDetails')
      .updateOne({ githubIssueId: issueDetails.githubIssueId }, updateFilter, { upsert: true });
  }

  async bulkUpsertByField(
    issues: IssueDetails[],
    identifyingField: keyof IssueDetails,
  ): Promise<BulkWriteResult> {
    const bulkOps = issues.map(issue => ({
      updateOne: {
        filter: { [identifyingField]: issue[identifyingField] },
        update: {
          $set: issue,
          $setOnInsert: {
            refreshStatus: 'PENDING' as const,
          },
        },
        upsert: true,
      },
    }));

    return this._db.collection<IssueDetails>('issueDetails').bulkWrite(bulkOps);
  }

  async update(issueDetails: Partial<WithId<IssueDetails>>): Promise<void> {
    const { _id, githubIssueId, ...updateData } = issueDetails;
    await this._db.collection<IssueDetails>('issueDetails').updateOne(
      { githubIssueId: issueDetails.githubIssueId },
      {
        $set: updateData,
      },
    );
  }

  async getPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Promise<PaginatedResults<IssueDetails>> {
    const skip = (page - 1) * limit;
    const filter: any = {};
    const orConditions: any[] = [];

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
      .collection<IssueDetails>('issueDetails')
      .countDocuments(filter);
    const issues = await this._db
      .collection<IssueDetails>('issueDetails')
      .find(filter)
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      results: issues,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
      },
    };
  }

  async findBy<K extends keyof IssueDetails>(
    key: K,
    value: IssueDetails[K],
  ): Promise<WithId<IssueDetails> | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne({ [key]: value });
  }

  async findWithLatestAuditBy<K extends keyof IssueDetails>(
    key: K,
    value: IssueDetails[K],
  ): Promise<WithId<IssueDetails> | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne(
      {
        [key]: value,
      },
      {
        sort: { 'currentAudit.started': -1 },
      },
    );
  }

  async getAll(): Promise<IssueDetails[]> {
    return this._db.collection<IssueDetails>('issueDetails').find({}).toArray();
  }

  async findApprovedBy(filter: Filter<IssueDetails>): Promise<IssueDetails | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne({
      ...filter,
      refreshStatus: 'APPROVED',
    });
  }

  async findPendingBy(filter: Filter<IssueDetails>): Promise<IssueDetails | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne({
      ...filter,
      refreshStatus: 'PENDING',
    });
  }

  async findSignedBy(filter: Filter<IssueDetails>): Promise<IssueDetails | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne({
      ...filter,
      refreshStatus: 'SIGNED_BY_RKH',
    });
  }
}

export { IssueDetailsRepository };
