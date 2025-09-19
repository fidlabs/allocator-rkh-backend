import { ICommandBus, IEventBus, IQueryBus } from '@filecoin-plus/core';
import { AsyncContainerModule, interfaces } from 'inversify';
import { Db } from 'mongodb';

import { TYPES } from '@src/types';
import { CommandBus } from './command-bus';

import { DatacapAllocatorEventStore } from '@src/infrastructure/event-store/datacap-allocator-event-store';
import { DatacapAllocatorRepository } from '@src/infrastructure/repositories/datacap-allocator-repository';
import {
  IDatacapAllocatorEventStore,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import config from '@src/config';
import { createMongodbConnection } from './db/mongodb';
import { QueryBus } from './query-bus';
import { GithubClient, GithubClientConfig, IGithubClient } from './clients/github';
import { AirtableClient, AirtableClientConfig, IAirtableClient } from './clients/airtable';
import { ILotusClient, LotusClient } from './clients/lotus';
import { InMemoryEventBus } from './event-bus/in-memory-event-bus';
import {
  ApplicationDetailsRepository,
  IApplicationDetailsRepository,
} from './repositories/application-details.repository';
import {
  IIssueDetailsRepository,
  IssueDetailsRepository,
} from '@src/infrastructure/repositories/issue-details.repository';
import { IIssueMapper, IssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { IRpcProvider, RpcProvider } from '@src/infrastructure/clients/rpc-provider';
import { DataCapMapper, IDataCapMapper } from '@src/infrastructure/mappers/data-cap-mapper';
import {
  IMetaAllocatorRepository,
  MetaAllocatorRepository,
} from './repositories/meta-allocator.repository';
import { GovernanceConfig, LotusClientConfig, RkhConfig, RpcProviderConfig } from './interfaces';
import { GithubConfig } from '@src/domain/types';
import { AuditMapper, IAuditMapper } from './mappers/audit-mapper';
import {
  IRefreshAuditService,
  RefreshAuditService,
} from '../application/services/refresh-audit.service';
import {
  IRefreshAuditPublisher,
  RefreshAuditPublisher,
} from '../application/publishers/refresh-audit-publisher';

export const infrastructureModule = new AsyncContainerModule(async (bind: interfaces.Bind) => {
  // MongoDB setup
  const db: Db = await createMongodbConnection(config.MONGODB_URI, config.DB_NAME);
  bind<Db>(TYPES.Db).toConstantValue(db);

  // Memory event bus
  bind<IEventBus>(TYPES.EventBus).to(InMemoryEventBus).inSingletonScope();

  // GitHub client configuration
  const githubClientConfig: GithubClientConfig = {
    appId: config.GITHUB_APP_ID,
    appPrivateKey: config.GITHUB_APP_PRIVATE_KEY,
    appInstallationId: config.GITHUB_APP_INSTALLATION_ID,
    githubToken: config.GITHUB_TOKEN,
  };

  const allocatorRegistryConfig: GithubConfig = {
    owner: config.GITHUB_OWNER,
    repo: config.GITHUB_REPO,
  };
  bind<GithubConfig>(TYPES.AllocatorRegistryConfig).toConstantValue(allocatorRegistryConfig);

  const allocatorGovernanceConfig: GithubConfig = {
    owner: config.GITHUB_ISSUES_OWNER,
    repo: config.GITHUB_ISSUES_REPO,
  };
  bind<GithubConfig>(TYPES.AllocatorGovernanceConfig).toConstantValue(allocatorGovernanceConfig);

  bind<GithubClientConfig>(TYPES.GithubClientConfig).toConstantValue(githubClientConfig);
  bind<IGithubClient>(TYPES.GithubClient).to(GithubClient).inSingletonScope();

  const rpcProviderConfig: RpcProviderConfig = {
    useTestNet: config.USE_TEST_NET,
    evmRpcUrl: config.EVM_RPC_URL,
    testNetConfig: {
      chainId: config.TEST_NET_CHAIN_ID,
      url: config.TEST_NET_URL,
      networkName: config.TEST_NET_NETWORK_NAME,
    },
  };
  bind<RpcProviderConfig>(TYPES.RpcProviderConfig).toConstantValue(rpcProviderConfig);
  bind<IRpcProvider>(TYPES.RpcProvider).to(RpcProvider).inSingletonScope();

  // Airtable client configuration
  const airtableClientConfig: AirtableClientConfig = {
    apiKey: config.AIRTABLE_API_KEY,
    baseId: config.AIRTABLE_BASE_ID,
    tableName: config.AIRTABLE_TABLE_NAME,
  };
  bind<AirtableClientConfig>(TYPES.AirtableClientConfig).toConstantValue(airtableClientConfig);
  bind<IAirtableClient>(TYPES.AirtableClient).to(AirtableClient);

  // Lotus client configuration
  const lotusClientConfig: LotusClientConfig = {
    rpcUrl: config.LOTUS_RPC_URL,
    authToken: config.LOTUS_AUTH_TOKEN,
  };
  bind<LotusClientConfig>(TYPES.LotusClientConfig).toConstantValue(lotusClientConfig);
  bind<ILotusClient>(TYPES.LotusClient).to(LotusClient);

  const rkhConfig: RkhConfig = {
    rkhAddress: config.RKH_ADDRESS,
    rkhThreshold: config.RKH_THRESHOLD,
  };
  bind<RkhConfig>(TYPES.RkhConfig).toConstantValue(rkhConfig);

  const governanceConfig = {
    addresses: config.GOVERNANCE_REVIEW_ADDRESSES,
  };
  bind<GovernanceConfig>(TYPES.GovernanceConfig).toConstantValue(governanceConfig);

  // Bindings
  bind<IDatacapAllocatorEventStore>(TYPES.DatacapAllocatorEventStore)
    .to(DatacapAllocatorEventStore)
    .inSingletonScope();
  bind<IDatacapAllocatorRepository>(TYPES.DatacapAllocatorRepository)
    .to(DatacapAllocatorRepository)
    .inSingletonScope();
  bind<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)
    .to(ApplicationDetailsRepository)
    .inSingletonScope();
  bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
    .to(IssueDetailsRepository)
    .inSingletonScope();
  bind<IMetaAllocatorRepository>(TYPES.MetaAllocatorRepository)
    .to(MetaAllocatorRepository)
    .inSingletonScope();
  bind<ICommandBus>(TYPES.CommandBus).toConstantValue(new CommandBus());
  bind<IQueryBus>(TYPES.QueryBus).toConstantValue(new QueryBus());

  // Mappers
  bind<IIssueMapper>(TYPES.IssueMapper).to(IssueMapper).inSingletonScope();
  bind<IDataCapMapper>(TYPES.DataCapMapper).to(DataCapMapper).inSingletonScope();
  bind<IAuditMapper>(TYPES.AuditMapper).to(AuditMapper).inSingletonScope();
  bind<IRefreshAuditService>(TYPES.RefreshAuditService).to(RefreshAuditService).inSingletonScope();

  bind<IRefreshAuditPublisher>(TYPES.RefreshAuditPublisher)
    .to(RefreshAuditPublisher)
    .inSingletonScope();
});
