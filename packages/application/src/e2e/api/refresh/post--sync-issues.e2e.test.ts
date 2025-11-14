import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Application, json, urlencoded } from 'express';
import { Container } from 'inversify';
import { Db } from 'mongodb';
import { InversifyExpressServer } from 'inversify-express-utils';
import * as dotenv from 'dotenv';
import { TestContainerBuilder } from '@mocks/builders';
import '@src/api/http/controllers/refresh.controller';
import { TYPES } from '@src/types';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

const githubMock = vi.hoisted(() => ({
  getIssues: vi.fn().mockResolvedValue([]),
  getIssue: vi.fn(),
  getFile: vi.fn(),
}));

const rpcProviderMock = vi.hoisted(() => ({
  getBlock: vi.fn(),
}));

describe('POST /api/v1/refreshes/sync/issues', () => {
  let app: Application;
  let container: Container;
  let db: Db;

  beforeAll(async () => {
    const builder = new TestContainerBuilder();
    await builder.withDatabase();
    const testSetup = builder
      .withLogger()
      .withEventBus()
      .withCommandBus()
      .withQueryBus()
      .withGithubClient(githubMock as unknown as IGithubClient)
      .withRpcProvider(rpcProviderMock as unknown as IRpcProvider)
      .withConfig(TYPES.MetaAllocatorConfig, { signers: ['0x999'] })
      .withConfig(TYPES.AllocatorGovernanceConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.AllocatorRegistryConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.GovernanceConfig, { addresses: ['0x123'] })
      .withMappers()
      .withServices()
      .withResolvers()
      .withPublishers()
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
    await db.collection('issueDetails').deleteMany({});
  });

  it('returns 200 when command succeeds', async () => {
    const commandBusStub = { send: vi.fn().mockResolvedValue({ success: true, data: {} }) };
    if (container.isBound(TYPES.CommandBus)) {
      container.rebind(TYPES.CommandBus).toConstantValue(commandBusStub);
    } else {
      container.bind(TYPES.CommandBus).toConstantValue(commandBusStub);
    }

    const response = await request(app).post('/api/v1/refreshes/sync/issues').expect(200);

    expect(response.body).toStrictEqual({
      status: '200',
      message: 'Refresh successful',
      data: { success: true, data: {} },
    });
    expect(commandBusStub.send).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when command fails', async () => {
    const error = new Error('boom');
    const commandBusStub = { send: vi.fn().mockResolvedValue({ success: false, error }) };
    if (container.isBound(TYPES.CommandBus)) {
      container.rebind(TYPES.CommandBus).toConstantValue(commandBusStub);
    } else {
      container.bind(TYPES.CommandBus).toConstantValue(commandBusStub);
    }

    const response = await request(app).post('/api/v1/refreshes/sync/issues').expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: 'Refresh failed',
      errors: error,
    });
    expect(commandBusStub.send).toHaveBeenCalledTimes(1);
  });
});
