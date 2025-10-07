import 'reflect-metadata';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { Container } from 'inversify';
import { Db, InsertOneResult } from 'mongodb';
import { Application, json, urlencoded } from 'express';
import { InversifyExpressServer } from 'inversify-express-utils';
import { GithubAuditFactory, DatabaseRefreshFactory } from '@mocks/factories';
import '@src/api/http/controllers/refresh.controller';
import { FilecoinTx, TestContainerBuilder } from '@mocks/builders';
import { FilecoinTxBuilder } from '@src/testing/mocks/builders';

import { TYPES } from '@src/types';
import {
  messageFactoryByType,
  SignatureType,
} from '@src/patterns/decorators/signature-guard.decorator';
import { IGithubClient } from '@src/infrastructure/clients/github';
import {
  AuditOutcome,
  IssueDetails,
  RefreshStatus,
} from '@src/infrastructure/repositories/issue-details';
import { IRpcProvider } from '@src/infrastructure/clients/rpc-provider';

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

describe('POST /api/v1/refreshes/:githubIssueId/review', () => {
  let app: Application;
  let container: Container;
  let db: Db;
  let transactions: {
    approve: FilecoinTx;
    reject: FilecoinTx;
    nonGovernanceTeamMember: FilecoinTx;
    invalidChallenge: FilecoinTx;
    incorrectAuditStatusForApprove: FilecoinTx;
    notExistingRefresh: FilecoinTx;
  };
  let fixturePendingRefresh: IssueDetails;
  let databasePendingRefresh: InsertOneResult<IssueDetails>;
  let fixtureRefreshWithIncorrectAuditStatusForApprove: IssueDetails;

  const messageFactory = messageFactoryByType[SignatureType.RefreshReview];

  const fixtureChallengeProps = { id: '123', finalDataCap: 1024, allocatorType: 'RKH' };
  const fixtureGithubPendingAudit = GithubAuditFactory.create(AuditOutcome.PENDING);
  const fixtureGithubGantedAudit = GithubAuditFactory.create(AuditOutcome.GRANTED);
  const fixtureAllocatorJsonMock = {
    pathway_addresses: { msig: 'f2abcdef1234567890' },
    ma_address: 'f4',
    metapathway_type: 'AMA',
    allocator_id: '1',
    audits: [fixtureGithubGantedAudit, fixtureGithubPendingAudit],
  };
  const fixtureFileContent = {
    content: JSON.stringify(fixtureAllocatorJsonMock),
  };
  const fixtureCreatePullRequestResponse = {
    number: 10,
    head: { sha: 'abc' },
    html_url: 'url',
  };

  beforeAll(async () => {
    const [
      correctApprove,
      correctReject,
      nonGovernanceTeamMember,
      invalidChallenge,
      incorrectAuditStatusForApprove,
      notExistingRefresh,
    ] = await Promise.all([
      new FilecoinTxBuilder()
        .withChallenge(messageFactory({ result: 'approve', ...fixtureChallengeProps }))
        .build(),
      new FilecoinTxBuilder()
        .withChallenge(messageFactory({ result: 'reject', ...fixtureChallengeProps }))
        .build(),
      new FilecoinTxBuilder()
        .withPrivateKeyHex('8f6a1c0d3b2e9f71c4d2a1b0e9f8c7d6b5a49382716f5e4d3c2b1a0918273645')
        .withChallenge(messageFactory({ result: 'approve', ...fixtureChallengeProps }))
        .build(),
      new FilecoinTxBuilder().withChallenge('invalid-challenge').build(),
      new FilecoinTxBuilder()
        .withChallenge(
          messageFactory({ result: 'approve', ...{ ...fixtureChallengeProps, id: '456' } }),
        )
        .build(),
      new FilecoinTxBuilder()
        .withChallenge(
          messageFactory({ result: 'approve', ...{ ...fixtureChallengeProps, id: '789' } }),
        )
        .build(),
    ]);

    transactions = {
      approve: correctApprove,
      reject: correctReject,
      nonGovernanceTeamMember,
      invalidChallenge,
      incorrectAuditStatusForApprove,
      notExistingRefresh,
    };

    const testBuilder = new TestContainerBuilder();
    await testBuilder.withDatabase();
    const testSetup = testBuilder
      .withLogger()
      .withConfig(TYPES.AllocatorGovernanceConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.AllocatorRegistryConfig, { owner: 'owner', repo: 'repo' })
      .withConfig(TYPES.GovernanceConfig, {
        addresses: [correctApprove.address],
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

    console.log(`Test setup complete. Database: ${db.databaseName}`);
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

    githubMock.getFile.mockResolvedValue(fixtureFileContent);
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

  function prepareGovernanceReviewPayload({ result }: { result: 'approve' | 'reject' }) {
    return {
      result,
      details: {
        reviewerAddress: transactions[result].address,
        reviewerPublicKey: transactions[result].pubKeyBase64,
        finalDataCap: fixtureChallengeProps.finalDataCap,
        allocatorType: fixtureChallengeProps.allocatorType,
      },
      signature: transactions[result].transaction,
    };
  }

  it('should approve refresh with valid governance team signature', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00.000Z');

    vi.setSystemTime(now);

    const response = await request(app)
      .post('/api/v1/refreshes/123/review')
      .send(
        prepareGovernanceReviewPayload({
          result: 'approve',
        }),
      )
      .expect(200);

    expect(response.body).toStrictEqual({
      status: '200',
      message: expect.stringContaining('success'),
      data: 'approve',
    });

    const refresh = await db.collection('issueDetails').findOne({ githubIssueNumber: 123 });

    expect(refresh).toStrictEqual({
      ...fixturePendingRefresh,
      _id: databasePendingRefresh.insertedId,
      dataCap: fixtureChallengeProps.finalDataCap,
      refreshStatus: RefreshStatus.APPROVED,
      auditHistory: [
        ...(fixturePendingRefresh.auditHistory || []),
        {
          auditChange: {
            outcome: AuditOutcome.APPROVED,
            ended: now.toISOString(),
            datacapAmount: fixtureChallengeProps.finalDataCap,
          },
          branchName: `refresh-audit-${fixturePendingRefresh.jsonNumber}-2-nanoid-id`,
          commitSha: fixtureCreatePullRequestResponse.head.sha,
          prNumber: fixtureCreatePullRequestResponse.number,
          prUrl: fixtureCreatePullRequestResponse.html_url,
        },
      ],
    });
    vi.useRealTimers();
  });

  it('should reject refresh with valid governance team signature', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00.000Z');

    vi.setSystemTime(now);

    const response = await request(app)
      .post('/api/v1/refreshes/123/review')
      .send(
        prepareGovernanceReviewPayload({
          result: 'reject',
        }),
      );

    expect(response.body).toStrictEqual({
      status: '200',
      message: expect.stringContaining('success'),
      data: 'reject',
    });

    const refresh = await db.collection('issueDetails').findOne({ githubIssueNumber: 123 });

    expect(refresh).toStrictEqual({
      ...fixturePendingRefresh,
      _id: databasePendingRefresh.insertedId,
      refreshStatus: RefreshStatus.REJECTED,
      auditHistory: [
        ...(fixturePendingRefresh.auditHistory || []),
        {
          auditChange: {
            outcome: AuditOutcome.REJECTED,
            ended: now.toISOString(),
          },
          branchName: `refresh-audit-${fixturePendingRefresh.jsonNumber}-2-nanoid-id`,
          commitSha: fixtureCreatePullRequestResponse.head.sha,
          prNumber: fixtureCreatePullRequestResponse.number,
          prUrl: fixtureCreatePullRequestResponse.html_url,
        },
      ],
    });
    vi.useRealTimers();
  });

  it('should return 400 for inalid id', async () => {
    const response = await request(app)
      .post('/api/v1/refreshes/invalid/review')
      .send(
        prepareGovernanceReviewPayload({
          result: 'approve',
        }),
      )
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: 'Validation failed',
      errors: ['Governance review github issue number must be a positive integer'],
    });
  });

  it('should return 400 for invalid request body', async () => {
    const response = await request(app)
      .post('/api/v1/refreshes/123/review')
      .send({
        result: 'approve',
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: 'Validation failed',
      errors: [
        'Governance review details is required',
        'Governance review details reviewer address is required',
        'Governance review details final data cap is required',
        'Governance review details allocator type is required',
        'Governance review details signature is required',
        'Governance review details reviewer public key is required',
      ],
    });
  });

  it('should return 400 for invalid result value', async () => {
    const payload = prepareGovernanceReviewPayload({
      result: 'reject',
    });
    payload.result = 'invalid' as any;

    const response = await request(app)
      .post('/api/v1/refreshes/123/review')
      .send(payload)
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: 'Validation failed',
      errors: ['Governance review result must be either approve or reject'],
    });
  });

  it('should return 403 for non-governance team member', async () => {
    const response = await request(app)
      .post('/api/v1/refreshes/123/review')
      .send({
        result: 'approve',
        details: {
          reviewerAddress: transactions.nonGovernanceTeamMember.address,
          reviewerPublicKey: transactions.nonGovernanceTeamMember.pubKeyBase64,
          finalDataCap: fixtureChallengeProps.finalDataCap,
          allocatorType: fixtureChallengeProps.allocatorType,
        },
        signature: transactions.nonGovernanceTeamMember.transaction,
      })
      .expect(403);

    expect(response.body).toStrictEqual({
      status: '403',
      message: 'Bad Permissions',
    });
  });

  it('should throw error when signature is invalid', async () => {
    const payload = prepareGovernanceReviewPayload({
      result: 'approve',
    });

    payload.signature = JSON.stringify({
      Message: 'invalid-message-base64',
      Signature: { Data: 'invalid-signature-base64' },
    });

    const response = await request(app)
      .post('/api/v1/refreshes/789/review')
      .send(payload)
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: "addresses don't match",
    });
  });

  it('should return 400 for signature with wrong challenge content', async () => {
    const response = await request(app)
      .post('/api/v1/refreshes/123/review')
      .send({
        result: 'approve',
        details: {
          reviewerAddress: transactions.invalidChallenge.address,
          reviewerPublicKey: transactions.invalidChallenge.pubKeyBase64,
          finalDataCap: fixtureChallengeProps.finalDataCap,
          allocatorType: fixtureChallengeProps.allocatorType,
        },
        signature: transactions.invalidChallenge.transaction,
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: "pre-images don't match",
    });
  });

  it('should return 400 for refresh with incorrect audit status for approve', async () => {
    const response = await request(app)
      .post('/api/v1/refreshes/456/review')
      .send({
        result: 'approve',
        details: {
          reviewerAddress: transactions.incorrectAuditStatusForApprove.address,
          reviewerPublicKey: transactions.incorrectAuditStatusForApprove.pubKeyBase64,
          finalDataCap: fixtureChallengeProps.finalDataCap,
          allocatorType: fixtureChallengeProps.allocatorType,
        },
        signature: transactions.incorrectAuditStatusForApprove.transaction,
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: 'Failed to upsert issue',
      errors: [
        'Cannot approve audit refresh because it is not in the correct status. GithubIssueNumber: 456',
      ],
    });
  });

  it('should throw error when trying to approve not existing refresh', async () => {
    const response = await request(app)
      .post('/api/v1/refreshes/789/review')
      .send({
        result: 'approve',
        details: {
          reviewerAddress: transactions.notExistingRefresh.address,
          reviewerPublicKey: transactions.notExistingRefresh.pubKeyBase64,
          finalDataCap: fixtureChallengeProps.finalDataCap,
          allocatorType: fixtureChallengeProps.allocatorType,
        },
        signature: transactions.notExistingRefresh.transaction,
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      status: '400',
      message: 'Failed to upsert issue',
      errors: [
        'Cannot approve audit refresh because it is not in the correct status. GithubIssueNumber: 789',
      ],
    });
  });
});
