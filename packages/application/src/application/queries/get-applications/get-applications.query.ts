import { IQuery, IQueryHandler } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { Db } from 'mongodb';

import { TYPES } from '@src/types';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import { ApplicationStatus } from '@src/domain/application/application';

export class GetApplicationsQuery implements IQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly status: ApplicationStatus[] = [],
    public readonly search?: string,
  ) {}
}

@injectable()
export class GetApplicationsQueryHandler implements IQueryHandler<GetApplicationsQuery, any> {
  queryToHandle = GetApplicationsQuery.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
    @inject(TYPES.Db) private readonly db: Db,
  ) {}

  async execute(query: GetApplicationsQuery) {
    return this._repository.getPaginated(query.page, query.limit, query.status, query.search);
  }
}
