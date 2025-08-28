import 'reflect-metadata';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Application, json, urlencoded } from 'express';
import { Container } from 'inversify';
import { Db } from 'mongodb';
import { InversifyExpressServer } from 'inversify-express-utils';
import * as dotenv from 'dotenv';
import { DatabaseRefreshFactory, GithubIssueFactory } from '@mocks/factories';
import { TestContainerBuilder } from '@mocks/builders';
import '@src/api/http/controllers/refresh.controller';
import { IGithubClient } from '@src/infrastructure/clients/github';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

describe('Refresh from Issue E2E', () => {
  let app: Application;
  let container: Container;
  let db: Db;

  const githubMock = vi.hoisted(() => ({
    getIssues: vi.fn(),
    getIssue: vi.fn(),
    getFile: vi.fn(),
  }));

  const fixtureAllocatorJsonMock = {
    pathway_addresses: { msig: 'f2abcdef1234567890' },
    ma_address: 'f4',
    metapathway_type: 'AMA',
    allocator_id: '1',
  };

  const mockFileContent = {
    content: JSON.stringify(fixtureAllocatorJsonMock),
  };

  beforeAll(async () => {
    const testBuilder = new TestContainerBuilder();
    await testBuilder.withDatabase();
    const testSetup = testBuilder
      .withLogger()
      .withEventBus()
      .withCommandBus()
      .withQueryBus()
      .withGithubClient(githubMock as unknown as IGithubClient)
      .withMappers()
      .withServices()
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

  beforeEach(() => {
    githubMock.getFile.mockResolvedValue(mockFileContent);
  });

  afterEach(async () => {
    await db.collection('issueDetails').deleteMany({});
    await db.collection('refreshDetails').deleteMany({});
    await db.collection('applicationDetails').deleteMany({});
  });

  describe('PUT /api/v1/refreshes/upsert-from-issue', () => {
    it('should add refresh by issue to database', async () => {
      const fixtureOpenedGithubEvent = GithubIssueFactory.createOpened();

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(fixtureOpenedGithubEvent)
        .expect(200);

      expect(response.body).toStrictEqual({
        message: 'Issue upserted successfully',
        status: '200',
      });

      const savedIssue = await db
        .collection('issueDetails')
        .findOne({ githubIssueId: fixtureOpenedGithubEvent.issue.id });

      expect(savedIssue).toStrictEqual({
        _id: savedIssue?._id,
        assignees: fixtureOpenedGithubEvent.issue.assignees?.map(assignee => ({
          name: assignee.login,
          userId: assignee.id,
        })),
        actorId: fixtureAllocatorJsonMock.allocator_id,
        msigAddress: fixtureAllocatorJsonMock.pathway_addresses.msig,
        maAddress: fixtureAllocatorJsonMock.ma_address,
        metapathwayType: fixtureAllocatorJsonMock.metapathway_type,
        githubIssueNumber: fixtureOpenedGithubEvent.issue.number,
        closedAt: null,
        createdAt: new Date(fixtureOpenedGithubEvent.issue.created_at),
        updatedAt: new Date(fixtureOpenedGithubEvent.issue.updated_at),
        creator: {
          name: fixtureOpenedGithubEvent.issue.user?.login,
          userId: fixtureOpenedGithubEvent.issue.user?.id,
        },
        githubIssueId: fixtureOpenedGithubEvent.issue.id,
        jsonNumber: expect.any(String),
        labels: fixtureOpenedGithubEvent.issue.labels.map(label =>
          typeof label === 'string' ? label : label.name,
        ),
        state: fixtureOpenedGithubEvent.issue.state,
        title: fixtureOpenedGithubEvent.issue.title.replace('[DataCap Refresh] ', ''),
        refreshStatus: 'PENDING',
      });
    });

    it('should update refresh in database by github issue id', async () => {
      const fixtureEditedGithubEvent = GithubIssueFactory.createEdited();
      const fixtureDatabaseIssue = DatabaseRefreshFactory.create();

      fixtureEditedGithubEvent.issue.id = fixtureDatabaseIssue.githubIssueId;

      await db.collection('issueDetails').insertOne(fixtureDatabaseIssue);

      const savedIssue = await db
        .collection('issueDetails')
        .findOne({ githubIssueId: fixtureDatabaseIssue.githubIssueId });

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(fixtureEditedGithubEvent)
        .expect(200);

      expect(response.body).toStrictEqual({
        message: 'Issue upserted successfully',
        status: '200',
      });

      const updatedIssue = await db
        .collection('issueDetails')
        .findOne({ githubIssueId: fixtureEditedGithubEvent.issue.id });

      expect(updatedIssue).toStrictEqual({
        _id: savedIssue?._id,
        actorId: fixtureAllocatorJsonMock.allocator_id,
        msigAddress: fixtureAllocatorJsonMock.pathway_addresses.msig,
        maAddress: fixtureAllocatorJsonMock.ma_address,
        githubIssueNumber: fixtureEditedGithubEvent.issue.number,
        metapathwayType: fixtureAllocatorJsonMock.metapathway_type,
        assignees: fixtureEditedGithubEvent.issue.assignees?.map(assignee => ({
          name: assignee.login,
          userId: assignee.id,
        })),
        dataCap: fixtureDatabaseIssue.dataCap,
        closedAt: null,
        createdAt: new Date(fixtureEditedGithubEvent.issue.created_at),
        updatedAt: new Date(fixtureEditedGithubEvent.issue.updated_at),
        creator: {
          name: fixtureEditedGithubEvent.issue.user?.login,
          userId: fixtureEditedGithubEvent.issue.user?.id,
        },
        githubIssueId: fixtureEditedGithubEvent.issue.id,
        jsonNumber: expect.any(String),
        labels: fixtureEditedGithubEvent.issue.labels.map(label =>
          typeof label === 'string' ? label : label.name,
        ),
        state: fixtureEditedGithubEvent.issue.state,
        title: fixtureEditedGithubEvent.issue.title.replace('[DataCap Refresh] ', ''),
        refreshStatus: 'PENDING',
      });
    });

    it('should throw validation error when issue is missing', async () => {
      const invalidPayload = {
        action: 'opened',
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: [
          'Issue is required',
          'Issue ID is required',
          'Issue body is required',
          'Issue title is required',
          'Issue state is required',
        ],
        message: 'Invalid body',
        status: '400',
      });
    });

    it('should throw validation error when issue ID is invalid', async () => {
      const invalidPayload = {
        action: 'opened',
        issue: {
          id: -1,
          body: 'test body',
          title: '[DataCap Refresh] Test',
          state: 'open',
        },
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Issue ID must be a positive integer'],
        message: 'Invalid body',
        status: '400',
      });
    });

    it('should throw validation error when issue title does not contain [DataCap Refresh]', async () => {
      const invalidPayload = {
        action: 'opened',
        issue: {
          id: 123,
          body: 'test body',
          title: 'Invalid Title',
          state: 'open',
        },
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Issue title must contain [DataCap Refresh]'],
        message: 'Invalid body',
        status: '400',
      });
    });

    it('should throw validation error when issue state is invalid', async () => {
      const invalidPayload = {
        action: 'opened',
        issue: {
          id: 123,
          body: 'test body',
          title: '[DataCap Refresh] Test',
          state: 'invalid',
        },
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Issue state must be either open or edited'],
        message: 'Invalid body',
        status: '400',
      });
    });

    it('should throw validation error when issue is not an object', async () => {
      const invalidPayload = {
        action: 'opened',
        issue: 'not an object',
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Issue must be an object'],
        message: 'Invalid body',
        status: '400',
      });
    });

    it('should throw validation error when issue title is not a string', async () => {
      const invalidPayload = {
        action: 'opened',
        issue: {
          id: 123,
          body: 'test body',
          title: 123,
          state: 'open',
        },
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Issue title must be a string'],
        message: 'Invalid body',
        status: '400',
      });
    });

    it('should throw validation error when issue body is not a string', async () => {
      const invalidPayload = {
        action: 'opened',
        issue: {
          id: 123,
          body: true,
          title: '[DataCap Refresh] Test',
          state: 'open',
        },
      };

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Issue body must be a string'],
        message: 'Invalid body',
        status: '400',
      });
    });
  });
});
