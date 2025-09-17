import 'reflect-metadata';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Application, json, urlencoded } from 'express';
import { Container } from 'inversify';
import { Db } from 'mongodb';
import { InversifyExpressServer } from 'inversify-express-utils';
import * as dotenv from 'dotenv';
import { DatabaseRefreshFactory, GithubAuditFactory, GithubIssueFactory } from '@mocks/factories';
import { TestContainerBuilder } from '@mocks/builders';
import '@src/api/http/controllers/refresh.controller';
import { IGithubClient } from '@src/infrastructure/clients/github';
import { TYPES } from '@src/types';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { faker } from '@faker-js/faker';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('nanoid-id'),
}));

describe('Refresh from Issue E2E', () => {
  let app: Application;
  let container: Container;
  let db: Db;

  const githubMock = vi.hoisted(() => ({
    getIssues: vi.fn(),
    getIssue: vi.fn(),
    getFile: vi.fn(),
    createBranch: vi.fn(),
    createPullRequest: vi.fn(),
    mergePullRequest: vi.fn(),
    deleteBranch: vi.fn(),
  }));

  const fixtureGithubPendingAudit = GithubAuditFactory.create(AuditOutcome.PENDING);
  const fixtureGithubGantedAudit = GithubAuditFactory.create(AuditOutcome.GRANTED);
  const fixturePendingAllocatorJson = {
    pathway_addresses: { msig: `f2${faker.string.alphanumeric(36)}` },
    ma_address: `f4${faker.string.alphanumeric(36)}`,
    metapathway_type: 'RKH',
    allocator_id: `f0${faker.string.numeric(7)}`,
    audits: [fixtureGithubGantedAudit, fixtureGithubPendingAudit],
  };
  const fixtureGantedAllocatorJson = {
    pathway_addresses: { msig: `f2${faker.string.alphanumeric(36)}` },
    ma_address: `f4${faker.string.alphanumeric(36)}`,
    metapathway_type: 'AMA',
    allocator_id: `f0${faker.string.numeric(7)}`,
    audits: [fixtureGithubGantedAudit],
  };
  const fixturePendingFileContent = { content: JSON.stringify(fixturePendingAllocatorJson) };
  const fixtureGantedFileContent = { content: JSON.stringify(fixtureGantedAllocatorJson) };
  const fixtureCreatePullRequestResponse = {
    number: 10,
    head: { sha: 'abc' },
    html_url: 'url',
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
      .withConfig(TYPES.AllocatorGovernanceConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.AllocatorRegistryConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.GovernanceConfig, { addresses: ['0x123'] })
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

  beforeEach(() => {
    githubMock.getFile.mockResolvedValue(fixturePendingFileContent);
    githubMock.createBranch.mockResolvedValue({ ref: 'refs/heads/b' });
    githubMock.createPullRequest.mockResolvedValue(fixtureCreatePullRequestResponse);
    githubMock.mergePullRequest.mockResolvedValue({});
    githubMock.deleteBranch.mockResolvedValue({});
  });

  afterEach(async () => {
    await db.collection('issueDetails').deleteMany({});
    await db.collection('refreshDetails').deleteMany({});
    await db.collection('applicationDetails').deleteMany({});
  });

  describe('PUT /api/v1/refreshes/upsert-from-issue', () => {
    /**
     * when:
     * - allocator has not pending audit on github and databasede described by @jsonNumber
     * - refresh for given github issue id does not exist in database
     * then:
     * - should add refresh by @githubIssueId to database
     * - should call publisher with new audit
     */
    it('should add refresh by issue to database and call publisher with new audit', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00.000Z');
      const fixtureJsonHash = `rec${faker.string.alphanumeric(12)}`;
      const fixtureOpenedGithubEvent = GithubIssueFactory.createOpened({
        allocator: { jsonNumber: fixtureJsonHash },
      });

      vi.setSystemTime(now);
      githubMock.getFile.mockResolvedValue(fixtureGantedFileContent);

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
        actorId: fixtureGantedAllocatorJson.allocator_id,
        msigAddress: fixtureGantedAllocatorJson.pathway_addresses.msig,
        maAddress: fixtureGantedAllocatorJson.ma_address,
        metapathwayType: fixtureGantedAllocatorJson.metapathway_type,
        githubIssueNumber: fixtureOpenedGithubEvent.issue.number,
        closedAt: null,
        createdAt: new Date(fixtureOpenedGithubEvent.issue.created_at),
        updatedAt: new Date(fixtureOpenedGithubEvent.issue.updated_at),
        creator: {
          name: fixtureOpenedGithubEvent.issue.user?.login,
          userId: fixtureOpenedGithubEvent.issue.user?.id,
        },
        githubIssueId: fixtureOpenedGithubEvent.issue.id,
        jsonNumber: fixtureJsonHash,
        labels: fixtureOpenedGithubEvent.issue.labels.map(label =>
          typeof label === 'string' ? label : label.name,
        ),
        state: fixtureOpenedGithubEvent.issue.state,
        title: fixtureOpenedGithubEvent.issue.title.replace('[DataCap Refresh] ', ''),
        refreshStatus: 'PENDING',
        lastAudit: {
          dcAllocated: fixtureGithubGantedAudit.dc_allocated,
          datacapAmount: fixtureGithubGantedAudit.datacap_amount,
          ended: fixtureGithubGantedAudit.ended,
          outcome: fixtureGithubGantedAudit.outcome,
          started: fixtureGithubGantedAudit.started,
        },
        currentAudit: {
          dcAllocated: '',
          datacapAmount: '',
          ended: '',
          outcome: AuditOutcome.PENDING,
          started: now.toISOString(),
        },
        auditHistory: [
          {
            auditChange: {
              dcAllocated: '',
              datacapAmount: '',
              ended: '',
              outcome: AuditOutcome.PENDING,
              started: now.toISOString(),
            },
            branchName: `refresh-audit-${fixtureJsonHash}-2-nanoid-id`,
            commitSha: fixtureCreatePullRequestResponse.head.sha,
            prNumber: fixtureCreatePullRequestResponse.number,
            prUrl: fixtureCreatePullRequestResponse.html_url,
          },
        ],
      });

      expect(githubMock.createBranch).toHaveBeenCalled();
      expect(githubMock.createPullRequest).toHaveBeenCalled();
      expect(githubMock.mergePullRequest).toHaveBeenCalled();
      expect(githubMock.deleteBranch).toHaveBeenCalled();
    });

    /**
     * when:
     * - allocator has pending audit on github and database described by @jsonNumber
     * - refresh for given github issue id exists and has pending audit
     * then:
     * - should update refresh by @githubIssueId in database
     * - should skip publisher since audit is already pending
     */
    it('should update refresh in database by github issue id and skip publisher since audit is already pending ', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00.000Z');
      const fixtureJsonHash = `rec${faker.string.alphanumeric(12)}`;
      const fixtureEditedGithubEvent = GithubIssueFactory.createEdited({
        allocator: { jsonNumber: fixtureJsonHash },
      });
      const fixtureDatabaseIssue = DatabaseRefreshFactory.createWithAudit(AuditOutcome.PENDING);

      vi.setSystemTime(now);
      fixtureEditedGithubEvent.issue.id = fixtureDatabaseIssue.githubIssueId;
      githubMock.getFile.mockResolvedValue(fixturePendingFileContent);

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

      expect(githubMock.getFile).toHaveBeenCalledWith(
        'threesigmaxyz',
        'Allocator-Registry',
        `Allocators/${fixtureJsonHash}.json`,
      );

      expect(updatedIssue).toStrictEqual({
        // udates iherited from allocator json
        actorId: fixturePendingAllocatorJson.allocator_id,
        msigAddress: fixturePendingAllocatorJson.pathway_addresses.msig,
        maAddress: fixturePendingAllocatorJson.ma_address,
        metapathwayType: fixturePendingAllocatorJson.metapathway_type,
        lastAudit: {
          dcAllocated: fixturePendingAllocatorJson.audits[0].dc_allocated,
          datacapAmount: fixturePendingAllocatorJson.audits[0].datacap_amount,
          ended: fixturePendingAllocatorJson.audits[0].ended,
          outcome: fixturePendingAllocatorJson.audits[0].outcome,
          started: fixturePendingAllocatorJson.audits[0].started,
        },
        currentAudit: {
          dcAllocated: fixturePendingAllocatorJson.audits[1].dc_allocated,
          datacapAmount: fixturePendingAllocatorJson.audits[1].datacap_amount,
          ended: fixturePendingAllocatorJson.audits[1].ended,
          outcome: fixturePendingAllocatorJson.audits[1].outcome,
          started: fixturePendingAllocatorJson.audits[1].started,
        },
        // fields updated by github issue
        githubIssueNumber: fixtureEditedGithubEvent.issue.number,
        state: fixtureEditedGithubEvent.issue.state,
        title: fixtureEditedGithubEvent.issue.title.replace('[DataCap Refresh] ', ''),
        jsonNumber: fixtureJsonHash,
        labels: fixtureEditedGithubEvent.issue.labels.map(label =>
          typeof label === 'string' ? label : label.name,
        ),
        closedAt: null,
        createdAt: new Date(fixtureEditedGithubEvent.issue.created_at),
        updatedAt: new Date(fixtureEditedGithubEvent.issue.updated_at),
        creator: {
          name: fixtureEditedGithubEvent.issue.user?.login,
          userId: fixtureEditedGithubEvent.issue.user?.id,
        },
        assignees: fixtureEditedGithubEvent.issue.assignees?.map(assignee => ({
          name: assignee.login,
          userId: assignee.id,
        })),
        // fields preserved
        _id: savedIssue?._id,
        dataCap: savedIssue?.dataCap,
        githubIssueId: savedIssue?.githubIssueId,
        refreshStatus: 'PENDING',
        auditHistory: savedIssue?.auditHistory?.map(audit => ({
          auditChange: audit.auditChange,
          branchName: audit.branchName,
          commitSha: audit.commitSha,
          prNumber: audit.prNumber,
          prUrl: audit.prUrl,
        })),
      });

      expect(githubMock.createBranch).not.toHaveBeenCalled();
      expect(githubMock.createPullRequest).not.toHaveBeenCalled();
      expect(githubMock.mergePullRequest).not.toHaveBeenCalled();
      expect(githubMock.deleteBranch).not.toHaveBeenCalled();
    });

    /**
     * when:
     * - allocator has pending audit on github and database described by @jsonNumber
     * - refresh for given github issue doesn't exist in database
     * then:
     * - should throw error when upserting new issue but allocator has pending audit
     */
    it('should throw error when upserting new issue but allocator has pending audit', async () => {
      const fixtureOpenedGithubEvent = GithubIssueFactory.createOpened();
      const fixtureDatabaseIssue = DatabaseRefreshFactory.create();
      await db.collection('issueDetails').insertOne(fixtureDatabaseIssue);

      const response = await request(app)
        .put('/api/v1/refreshes/upsert-from-issue')
        .send(fixtureOpenedGithubEvent)
        .expect(400);

      expect(response.body).toStrictEqual({
        errors: ['Pending audit found'],
        message: 'Failed to upsert issue',
        status: '400',
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
