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
import {
  ApplicationDetailsRepository,
  IApplicationDetailsRepository,
} from '@src/infrastructure/repositories/application-details.repository';
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
import { RefreshAuditService } from '@src/application/services/refresh-audit.service';
import { AuditMapper, IAuditMapper } from '@src/infrastructure/mappers/audit-mapper';
import { AllocationPathResolver } from '@src/application/resolvers/allocation-path-resolver';
import { AuditOutcomeResolver } from '@src/application/resolvers/audit-outcome-resolver';
import { UpsertIssueStrategyResolver } from '@src/application/use-cases/refresh-issues/upsert-issue.strategy';
import { RefreshAuditPublisher } from '@src/application/publishers/refresh-audit-publisher';
import { SignRefreshByRKHCommandHandler } from '@src/application/use-cases/update-rkh-approvals/sign-refresh-by-rkh.command';
import { ApproveRefreshByRKHCommandHandler } from '@src/application/use-cases/update-rkh-approvals/approve-refresh-by-rkh.command';
import { ApproveRefreshByMaCommandHandler } from '@src/application/use-cases/update-ma-approvals/approve-refresh-by-ma.command';
import { SaveIssueWithNewAuditCommandHandler } from '@src/application/use-cases/refresh-issues/save-issue-with-new-audit.command';
import { SaveIssueCommandHandler } from '@src/application/use-cases/refresh-issues/save-issue.command';
import { MessageService } from '@src/application/services/message.service';
import { PullRequestService } from '@src/application/services/pull-request.service';
import { RoleService } from '@src/application/services/role.service';
import { ApproveRefreshCommandHandler } from '@src/application/use-cases/refresh-issues/approve-refresh.command';
import { RejectRefreshCommandHandler } from '@src/application/use-cases/refresh-issues/reject-refesh.command';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';

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

  withConfig(type: symbol, config = {}) {
    this.container.bind<any>(type).toConstantValue(config);
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

  withRpcProvider(provider = {} as IRpcProvider) {
    this.container.bind<IRpcProvider>(TYPES.RpcProvider).toConstantValue(provider);
    return this;
  }

  withMappers() {
    this.container.bind<IIssueMapper>(TYPES.IssueMapper).to(IssueMapper).inSingletonScope();
    this.container.bind<IDataCapMapper>(TYPES.DataCapMapper).to(DataCapMapper).inSingletonScope();
    this.container.bind<IAuditMapper>(TYPES.AuditMapper).to(AuditMapper).inSingletonScope();
    return this;
  }

  withRepositories() {
    this.container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .to(IssueDetailsRepository)
      .inSingletonScope();

    this.container
      .bind<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)
      .to(ApplicationDetailsRepository)
      .inSingletonScope();

    this.container
      .bind<IMetaAllocatorRepository>(TYPES.MetaAllocatorRepository)
      .to(MetaAllocatorRepository)
      .inSingletonScope();

    return this;
  }

  withServices() {
    this.container.bind<IMetaAllocatorService>(TYPES.MetaAllocatorService).to(MetaAllocatorService);
    this.container.bind<RefreshAuditService>(TYPES.RefreshAuditService).to(RefreshAuditService);
    this.container.bind<MessageService>(TYPES.MessageService).to(MessageService);
    this.container.bind<PullRequestService>(TYPES.PullRequestService).to(PullRequestService);
    this.container.bind<RoleService>(TYPES.RoleService).to(RoleService);
    return this;
  }

  withCommandHandlers() {
    this.container.bind(TYPES.CommandHandler).to(RefreshIssuesCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(FetchIssuesCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(BulkCreateIssueCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(UpsertIssueCommandCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(FetchAllocatorCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(SignRefreshByRKHCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(ApproveRefreshByRKHCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(ApproveRefreshByMaCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(SaveIssueWithNewAuditCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(SaveIssueCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(ApproveRefreshCommandHandler);
    this.container.bind(TYPES.CommandHandler).to(RejectRefreshCommandHandler);
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

  withResolvers() {
    this.container
      .bind<UpsertIssueStrategyResolver>(TYPES.UpsertIssueStrategyResolver)
      .to(UpsertIssueStrategyResolver);

    this.container.bind<AuditOutcomeResolver>(TYPES.AuditOutcomeResolver).to(AuditOutcomeResolver);

    this.container
      .bind<AllocationPathResolver>(TYPES.AllocationPathResolver)
      .to(AllocationPathResolver);

    return this;
  }

  withPublishers() {
    this.container
      .bind<RefreshAuditPublisher>(TYPES.RefreshAuditPublisher)
      .to(RefreshAuditPublisher);
    return this;
  }

  build() {
    return { container: this.container, db: this.db! };
  }
}
