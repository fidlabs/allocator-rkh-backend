import { IRepository } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { BulkWriteResult, Db, Filter, FindOptions, UpdateFilter, WithId } from 'mongodb';
import { TYPES } from '@src/types';
import { IssueDetails, RefreshStatus } from '@src/infrastructure/repositories/issue-details';

type PaginatedResults<T> = {
  results: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

type GetPaginatedQuery = {
  page: number;
  limit: number;
  search?: string;
  filters?: {
    refreshStatus?: RefreshStatus[];
  };
};

export interface IIssueDetailsRepository extends IRepository<IssueDetails> {
  update(issueDetails: Partial<IssueDetails>): Promise<void>;

  getPaginated({
    page,
    limit,
    search,
    filters,
  }: GetPaginatedQuery): Promise<PaginatedResults<IssueDetails>>;

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
    options?: FindOptions,
  ): Promise<WithId<IssueDetails> | null>;

  findLatestBy<K extends keyof IssueDetails>(
    key: K,
    value: IssueDetails[K],
    options?: FindOptions,
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

  async getPaginated({
    page,
    limit,
    search,
    filters,
  }: GetPaginatedQuery): Promise<PaginatedResults<IssueDetails>> {
    const skip: number = (page - 1) * limit;
    const filter: Filter<IssueDetails> = {};

    if (filters?.refreshStatus?.length) {
      filter.$or = [
        {
          refreshStatus: {
            $in: filters.refreshStatus,
          },
        },
      ];
    }

    const trimmedSearch: string | undefined = search?.trim();
    if (trimmedSearch) {
      const escaped: string = trimmedSearch.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
      const regexCondition = { $regex: escaped, $options: 'i' };

      filter.$and = [
        {
          $or: [
            { title: regexCondition },
            { msigAddress: regexCondition },
            { jsonNumber: regexCondition },
          ],
        },
      ];
    }

    const collection = this._db.collection<IssueDetails>('issueDetails');

    const [totalCount, issues] = await Promise.all([
      collection.countDocuments(filter),
      collection
        .find(filter, {
          skip,
          limit,
          sort: { createdAt: -1 },
        })
        .toArray(),
    ]);

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
    options?: FindOptions,
  ): Promise<WithId<IssueDetails> | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne({ [key]: value }, options);
  }

  async findLatestBy<K extends keyof IssueDetails>(
    key: K,
    value: IssueDetails[K],
  ): Promise<WithId<IssueDetails> | null> {
    return this._db.collection<IssueDetails>('issueDetails').findOne(
      {
        [key]: value,
      },
      {
        sort: { createdAt: -1 },
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
