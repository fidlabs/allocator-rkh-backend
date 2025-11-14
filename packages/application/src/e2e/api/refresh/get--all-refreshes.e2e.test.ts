import 'reflect-metadata';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Db } from 'mongodb';
import { Application, json, urlencoded } from 'express';
import { InversifyExpressServer } from 'inversify-express-utils';
import { DatabaseRefreshFactory } from '@mocks/factories';
import '@src/api/http/controllers/refresh.controller';
import { TestContainerBuilder } from '@mocks/builders';
import * as dotenv from 'dotenv';
import { TYPES } from '@src/types';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

describe('GET /api/v1/refreshes', () => {
  let app: Application;
  let container: Container;
  let db: Db;

  const rpcProviderMock = vi.hoisted(() => ({
    getBlock: vi.fn(),
  }));

  beforeAll(async () => {
    const testBuilder = new TestContainerBuilder();
    await testBuilder.withDatabase();
    const testSetup = testBuilder
      .withLogger()
      .withEventBus()
      .withCommandBus()
      .withQueryBus()
      .withGithubClient({} as unknown as IGithubClient)
      .withConfig(TYPES.MetaAllocatorConfig, { signers: ['0x999'] })
      .withConfig(TYPES.AllocatorGovernanceConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.AllocatorRegistryConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.GovernanceConfig, { addresses: ['0x123'] })
      .withRpcProvider(rpcProviderMock as unknown as IRpcProvider)
      .withResolvers()
      .withServices()
      .withPublishers()
      .withMappers()
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

  afterEach(async () => {
    await db.collection('issueDetails').deleteMany({});
    await db.collection('refreshDetails').deleteMany({});
    await db.collection('applicationDetails').deleteMany({});
  });

  it('should return empty collection', async () => {
    const response = await request(app).get('/api/v1/refreshes?page=1&limit=2');

    expect(response.body).toStrictEqual({
      status: '200',
      message: 'Retrieved refreshes',
      data: {
        pagination: {
          currentPage: 1,
          itemsPerPage: 2,
          totalItems: 0,
          totalPages: 0,
        },
        results: [],
      },
    });
  });

  it('should return list of refreshes with pagination', async () => {
    const issues = Array.from({ length: 3 }, () => DatabaseRefreshFactory.create());
    await db.collection('issueDetails').insertMany(issues);

    const response = await request(app).get('/api/v1/refreshes?page=1&limit=2');

    expect(response.body).toStrictEqual({
      status: '200',
      message: 'Retrieved refreshes',
      data: {
        pagination: {
          currentPage: 1,
          itemsPerPage: 2,
          totalItems: 3,
          totalPages: 2,
        },
        results: response.body.data.results.map(item => ({
          _id: item._id,
          actorId: item.actorId,
          maAddress: item.maAddress,
          msigAddress: item.msigAddress,
          githubIssueId: item.githubIssueId,
          githubIssueNumber: item.githubIssueNumber,
          metapathwayType: item.metapathwayType,
          refreshStatus: item.refreshStatus,
          dataCap: item.dataCap,
          title: item.title,
          creator: {
            name: item.creator.name,
            userId: item.creator.userId,
          },
          assignees: item.assignees,
          labels: item.labels,
          state: item.state,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          closedAt: item.closedAt,
          jsonNumber: item.jsonNumber,
        })),
      },
    });
  });

  it('should return filtered refreshes when search parameter is provided', async () => {
    const searchTerm = 'testing search term';
    const issue = DatabaseRefreshFactory.create({
      title: `${searchTerm}`,
    });
    const otherIssues = Array.from({ length: 3 }, () => DatabaseRefreshFactory.create());
    await db.collection('issueDetails').insertMany([issue, ...otherIssues]);

    const response = await request(app)
      .get('/api/v1/refreshes')
      .query({ search: searchTerm })
      .expect(200);

    expect(response.body.data.results).toHaveLength(1);
    expect(response.body.data.results[0].title).toContain(searchTerm);

    expect(response.body).toStrictEqual({
      status: '200',
      message: 'Retrieved refreshes',
      data: {
        pagination: {
          currentPage: response.body.data.pagination.currentPage,
          itemsPerPage: response.body.data.pagination.itemsPerPage,
          totalItems: response.body.data.pagination.totalItems,
          totalPages: response.body.data.pagination.totalPages,
        },
        results: response.body.data.results.map((item: any) => ({
          _id: item._id,
          githubIssueId: item.githubIssueId,
          githubIssueNumber: item.githubIssueNumber,
          actorId: item.actorId,
          maAddress: item.maAddress,
          msigAddress: item.msigAddress,
          refreshStatus: item.refreshStatus,
          metapathwayType: item.metapathwayType,
          dataCap: item.dataCap,
          title: item.title,
          creator: {
            name: item.creator.name,
            userId: item.creator.userId,
          },
          assignees: item.assignees,
          labels: item.labels,
          state: item.state,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          closedAt: item.closedAt,
          jsonNumber: item.jsonNumber,
        })),
      },
    });
  });

  it('should filter refreshes when status parameter is provided', async () => {
    const status = RefreshStatus.PENDING;
    const pendingIssue = DatabaseRefreshFactory.create({
      refreshStatus: status,
    });
    const otherIssue = DatabaseRefreshFactory.create({
      refreshStatus: RefreshStatus.APPROVED,
    });
    await db.collection('issueDetails').insertMany([pendingIssue, otherIssue]);

    const response = await request(app)
      .get('/api/v1/refreshes')
      .query({ 'status[]': [status] })
      .expect(200);

    expect(response.body.data.results).toHaveLength(1);
    expect(response.body.data.results[0].refreshStatus).toBe(status);

    expect(response.body).toStrictEqual({
      status: '200',
      message: 'Retrieved refreshes',
      data: {
        pagination: {
          currentPage: response.body.data.pagination.currentPage,
          itemsPerPage: response.body.data.pagination.itemsPerPage,
          totalItems: response.body.data.pagination.totalItems,
          totalPages: response.body.data.pagination.totalPages,
        },
        results: response.body.data.results.map((item: any) => ({
          _id: item._id,
          githubIssueId: item.githubIssueId,
          githubIssueNumber: item.githubIssueNumber,
          actorId: item.actorId,
          maAddress: item.maAddress,
          msigAddress: item.msigAddress,
          refreshStatus: item.refreshStatus,
          metapathwayType: item.metapathwayType,
          dataCap: item.dataCap,
          title: item.title,
          creator: {
            name: item.creator.name,
            userId: item.creator.userId,
          },
          assignees: item.assignees,
          labels: item.labels,
          state: item.state,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          closedAt: item.closedAt,
          jsonNumber: item.jsonNumber,
        })),
      },
    });
  });

  it('should return 400 when invalid query parameters are provided', async () => {
    const response = await request(app)
      .get('/api/v1/refreshes')
      .query({
        page: -1,
        limit: 'invalid',
        search: 123,
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      errors: ['Query page must be a positive integer', 'Query limit must be a positive integer'],
      status: '400',
      message: 'Invalid query parameters',
    });
  });

  it('should return 400 when invalid status parameter is provided', async () => {
    const response = await request(app)
      .get('/api/v1/refreshes')
      .query({ status: 'invalid' })
      .expect(400);

    expect(response.body).toStrictEqual({
      errors: ['Query status must be an array'],
      status: '400',
      message: 'Invalid query parameters',
    });
  });

  it('should return 400 when invalid status item is provided', async () => {
    const response = await request(app)
      .get('/api/v1/refreshes')
      .query({ 'status[]': ['invalid'] })
      .expect(400);

    expect(response.body).toStrictEqual({
      errors: ['Query status item must be a valid status'],
      status: '400',
      message: 'Invalid query parameters',
    });
  });
});
