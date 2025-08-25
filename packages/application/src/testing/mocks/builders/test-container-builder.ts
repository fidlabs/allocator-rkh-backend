import { Container } from 'inversify';
import { Db } from 'mongodb';
import { TYPES } from '@src/types';
import config from '@src/config';
import { createMongodbConnection } from '@src/infrastructure/db/mongodb';
import {
  createWinstonLogger,
  ICommand,
  ICommandBus,
  ICommandHandler,
  IEventBus,
  IQueryBus,
  IQueryHandler,
  Logger,
} from '@filecoin-plus/core';
import { InMemoryEventBus } from '@src/infrastructure/event-bus/in-memory-event-bus';
import { CommandBus } from '@src/infrastructure/command-bus';
import { QueryBus } from '@src/infrastructure/query-bus';
import { IGithubClient } from '@src/infrastructure/clients/github';
import {
  IIssueDetailsRepository,
  IssueDetailsRepository,
} from '@src/infrastructure/repositories/issue-details.repository';
import { IIssueMapper, IssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { RefreshIssuesCommandHandler } from '@src/application/use-cases/refresh-issues/refresh-issues.command';
import { FetchIssuesCommandHandler } from '@src/application/use-cases/refresh-issues/fetch-issues.command';
import { BulkCreateIssueCommandHandler } from '@src/application/use-cases/refresh-issues/bulk-create-issue.command';
import { UpsertIssueCommandCommandHandler } from '@src/application/use-cases/refresh-issues/upsert-issue.command';
import { GetRefreshesQueryHandler } from '@src/application/queries/get-refreshes/get-refreshes.query';
import { FetchAllocatorCommandHandler } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';
import {
  IMetaAllocatorRepository,
  MetaAllocatorRepository,
} from '@src/infrastructure/repositories/meta-allocator.repository';
import { DataCapMapper, IDataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';
import {
  MetaAllocatorService,
  IMetaAllocatorService,
} from '@src/application/services/meta-allocator.service';

export class TestContainerBuilder {
  private container: Container;
  private db?: Db;

  constructor() {
    this.container = new Container();
  }

  async withDatabase(uri?: string, dbName?: string) {
    const testDbUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const testDbName = dbName || process.env.MONGODB_DATABASE || 'filecoin-plus-test';

    this.db = await createMongodbConnection(testDbUri, testDbName);
    this.container.bind<Db>(TYPES.Db).toConstantValue(this.db);
    await this.db.admin().ping();

    return this;
  }

  withLogger(name = 'test-refresh-e2e') {
    const logger = createWinstonLogger(name, config.LOG_LEVEL);
    this.container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
    return this;
  }

  withEventBus() {
    this.container.bind<IEventBus>(TYPES.EventBus).to(InMemoryEventBus).inSingletonScope();
    return this;
  }

  withCommandBus() {
    this.container.bind<ICommandBus>(TYPES.CommandBus).toConstantValue(new CommandBus());
    return this;
  }

  withQueryBus() {
    this.container.bind<IQueryBus>(TYPES.QueryBus).toConstantValue(new QueryBus());
    return this;
  }

  withGithubClient(client = {} as IGithubClient) {
    this.container.bind<IGithubClient>(TYPES.GithubClient).toConstantValue(client);
    return this;
  }

  withMappers() {
    this.container.bind<IIssueMapper>(TYPES.IssueMapper).to(IssueMapper).inSingletonScope();
    this.container.bind<IDataCapMapper>(TYPES.DataCapMapper).to(DataCapMapper).inSingletonScope();
    return this;
  }

  withRepositories() {
    this.container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .to(IssueDetailsRepository)
      .inSingletonScope();

    this.container
      .bind<IMetaAllocatorRepository>(TYPES.MetaAllocatorRepository)
      .to(MetaAllocatorRepository)
      .inSingletonScope();

    return this;
  }

  withServices() {
    this.container.bind<IMetaAllocatorService>(TYPES.MetaAllocatorService).to(MetaAllocatorService);
    return this;
  }

  withCommandHandlers() {
    this.container.bind(TYPES.CommandHandler).to(RefreshIssuesCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(FetchIssuesCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(BulkCreateIssueCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(UpsertIssueCommandCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(FetchAllocatorCommandHandler);
    return this;
  }

  withQueryHandlers() {
    this.container.bind(TYPES.QueryHandler).to(GetRefreshesQueryHandler);
    return this;
  }

  registerHandlers() {
    const commandBus = this.container.get<ICommandBus>(TYPES.CommandBus);
    const commandHandlers = this.container.getAll(TYPES.CommandHandler);
    commandHandlers.forEach(handler => {
      commandBus.registerHandler(handler as ICommandHandler<ICommand>);
    });

    const queryBus = this.container.get<IQueryBus>(TYPES.QueryBus);
    const queryHandlers = this.container.getAll(TYPES.QueryHandler);
    queryHandlers.forEach(handler => {
      queryBus.registerHandler(handler as IQueryHandler<ICommand>);
    });

    return this;
  }

  build() {
    return { container: this.container, db: this.db! };
  }
}
