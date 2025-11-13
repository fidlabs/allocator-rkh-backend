import 'reflect-metadata';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application, json, response, urlencoded } from 'express';
import '@src/api/http/controllers/meta-allocator.controller';
import * as dotenv from 'dotenv';
import { TestContainerBuilder } from '@mocks/builders';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';
import { TYPES } from '@src/types';
import { Db, InsertOneResult } from 'mongodb';
import { Container } from 'inversify';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { InversifyExpressServer } from 'inversify-express-utils';
import { DatabaseRefreshFactory } from '@src/testing/mocks/factories';
import { IssueDetails, RefreshStatus } from '@src/infrastructure/repositories/issue-details';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

const githubMock = vi.hoisted(() => ({
  createBranch: vi.fn(),
  createPullRequest: vi.fn(),
  mergePullRequest: vi.fn(),
  deleteBranch: vi.fn(),
  getFile: vi.fn(),
}));

const rpcProviderMock = vi.hoisted(() => ({
  getBlock: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('nanoid-id'),
}));

describe('POST /api/v1/ma/:githubIssueNumber/reject', () => {
  let app: Application;
  let container: Container;
  let db: Db;
  let fixturePendingRefresh: IssueDetails;
  let databasePendingRefresh: InsertOneResult<IssueDetails>;
  let fixtureRefreshWithIncorrectAuditStatusForApprove: IssueDetails;
  let databaseRefreshWithIncorrectAuditStatusForApprove: InsertOneResult<IssueDetails>;

  beforeAll(async () => {
    const testBuilder = new TestContainerBuilder();
    await testBuilder.withDatabase();
    const testSetup = testBuilder
      .withLogger()
      .withConfig(TYPES.AllocatorGovernanceConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.AllocatorRegistryConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.GovernanceConfig, {
        addresses: ['0x123'],
      })
      .withRpcProvider(rpcProviderMock as unknown as IRpcProvider)
      .withEventBus()
      .withCommandBus()
      .withQueryBus()
      .withMappers()
      .withResolvers()
      .withPublishers()
      .withServices()
      .withGithubClient(githubMock as unknown as IGithubClient)
      .withRepositories()
      .withCommandHandlers()
      .withQueryHandlers()
      .registerHandlers()
      .build();

    container = testSetup.container;
    db = testSetup.db;

    const server = new InversifyExpressServer(container);
    server.setConfig((app: Application) => {
      app.use(urlencoded({ extended: true }));
      app.use(json());
    });

    app = server.build();
    app.listen();
  });

  beforeEach(async () => {
    fixturePendingRefresh = DatabaseRefreshFactory.create({
      githubIssueNumber: 123,
      refreshStatus: RefreshStatus.PENDING,
    });
    fixtureRefreshWithIncorrectAuditStatusForApprove = DatabaseRefreshFactory.create({
      githubIssueNumber: 456,
      refreshStatus: RefreshStatus.DC_ALLOCATED,
    });

    databasePendingRefresh = await db
      .collection<IssueDetails>('issueDetails')
      .insertOne(fixturePendingRefresh);

    await db
      .collection<IssueDetails>('issueDetails')
      .insertOne(fixtureRefreshWithIncorrectAuditStatusForApprove);
  });

  afterEach(async () => {
    await db.collection('issueDetails').deleteMany({});
    await db.collection('refreshDetails').deleteMany({});
    await db.collection('applicationDetails').deleteMany({});
  });

  it('should reject a refresh as MetaAllocator', async () => {
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: { reviewerAddress: '0x123' },
        signature: '0x123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      status: '200',
      message: 'Refresh rejected as MetaAllocator was successful',
      data: 'reject',
    });
  });
});
