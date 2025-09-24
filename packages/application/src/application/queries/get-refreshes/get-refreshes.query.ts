import { IQuery, IQueryHandler } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';

export class GetRefreshesQuery implements IQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly search?: string,
    public readonly status?: RefreshStatus[],
  ) {}
}

@injectable()
export class GetRefreshesQueryHandler implements IQueryHandler<GetRefreshesQuery, any> {
  queryToHandle = GetRefreshesQuery.name;

  constructor(
    @inject(TYPES.IssueDetailsRepository) private readonly _repository: IIssueDetailsRepository,
  ) {}

  async execute(query: GetRefreshesQuery) {
    return this._repository.getPaginated({
      page: query.page,
      limit: query.limit,
      search: query.search,
      ...(query.status && {
        filters: {
          refreshStatus: query.status,
        },
      }),
    });
  }
}
