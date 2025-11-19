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
import {
  AuditOutcome,
  IssueDetails,
  RefreshStatus,
} from '@src/infrastructure/repositories/issue-details';
import {
  messageFactoryByType,
  SignatureType,
} from '@src/patterns/decorators/signature-guard.decorator';
import { Wallet } from 'ethers';

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

const metaAllocatorWallet = new Wallet(
  '0x59c6995e998f97a5a0044966f094538b292f17fba95a2c7c6c4a0d2b6f8a4f61',
);
const nonMetaAllocatorWallet = new Wallet(
  '0x8b3a350cf5c34c9194ca85829a2db0f1a0f9a166bf8c7c2281b5e9f3b6c2c8e1',
);

const signMessageWithWallet = (
  wallet: Wallet,
  details: { id: string; allocatorType: string; result: string; finalDataCap: number },
) => {
  const message = messageFactoryByType[SignatureType.MetaAllocatorReject](details);
  return wallet.signMessage(message);
};

describe('POST /api/v1/ma/:githubIssueNumber/reject', () => {
  let app: Application;
  let container: Container;
  let db: Db;
  let fixturePendingRefresh: IssueDetails;
  let fixtureRefreshWithIncorrectAuditStatusForApprove: IssueDetails;

  const fixtureFileContent = {
    content: JSON.stringify({
      pathway_addresses: { msig: 'f2abcdef1234567890' },
      ma_address: 'f4',
      metapathway_type: 'AMA',
      allocator_id: '1',
      audits: [
        {
          started: '2021-01-01',
          ended: '2021-01-01',
          dc_allocated: '1024',
          outcome: 'GRANTED',
          datacap_amount: 100,
        },
        {
          started: '2021-01-01',
          ended: '',
          dc_allocated: '',
          outcome: 'PENDING',
          datacap_amount: '',
        },
      ],
    }),
  };
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
      .withConfig(TYPES.MetaAllocatorConfig, {
        signers: [metaAllocatorWallet.address.toLowerCase()],
      })
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

    await db.collection<IssueDetails>('issueDetails').insertOne(fixturePendingRefresh);

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

  it('should reject a refresh as MetaAllocator', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    const details = { id: '123', allocatorType: 'AMA', result: 'reject', finalDataCap: 0 };

    const signature = await signMessageWithWallet(metaAllocatorWallet, details);
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: metaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      data: 'reject',
      message: 'Refresh rejected as MetaAllocator was successful',
      status: '200',
    });

    const dbRefresh = await db
      .collection<IssueDetails>('issueDetails')
      .findOne({ githubIssueNumber: 123 });
    expect(dbRefresh).toStrictEqual({
      ...fixturePendingRefresh,
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
      refreshStatus: RefreshStatus.REJECTED,
    });
  });

  it('should return 400 when refresh is not in PENDING status', async () => {
    const details = { id: '456', allocatorType: 'AMA', finalDataCap: 0, result: 'reject' };
    const signature = await signMessageWithWallet(metaAllocatorWallet, details);

    const response = await request(app)
      .post('/api/v1/ma/456/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: metaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature,
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      message:
        'Cannot reject audit refresh because it is not in the correct status. GithubIssueNumber: 456',
      status: '400',
    });
  });

  it('should throw validation error when details are invalid', async () => {
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: '0x123',
          reviewerPublicKey: 'fixturePublicKey',
          finalDataCap: '0',
          allocatorType: 'AMA',
        },
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      message: 'Validation failed',
      status: '400',
      errors: ['Governance review details signature is required'],
    });
  });

  it('should throw validation error when signature is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      message: 'Validation failed',
      status: '400',
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

  it('should return 403 when user is not a MetaAllocator', async () => {
    const details = { id: '123', allocatorType: 'AMA', result: 'reject', finalDataCap: 0 };
    const signature = await signMessageWithWallet(nonMetaAllocatorWallet, details);
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: nonMetaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature,
      })
      .expect(403);

    expect(response.body).toStrictEqual({
      message: 'Bad Permissions',
      status: '403',
    });
  });

  it('should return 400 when refresh is not found', async () => {
    const details = { id: '789', allocatorType: 'AMA', result: 'reject', finalDataCap: 0 };
    const signature = await signMessageWithWallet(metaAllocatorWallet, details);
    const response = await request(app)
      .post('/api/v1/ma/789/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: metaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature,
      })
      .expect(400);

    expect(response.body).toStrictEqual({
      message:
        'Cannot reject audit refresh because it is not in the correct status. GithubIssueNumber: 789',
      status: '400',
    });
  });

  it('should return 403 when signature verification fails (wrong wallet)', async () => {
    const details = { id: '123', allocatorType: 'AMA', result: 'reject', finalDataCap: 0 };
    const signature = await signMessageWithWallet(nonMetaAllocatorWallet, details);
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: metaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature,
      });

    expect(response.body).toStrictEqual({
      message: 'Signature verification failure.',
      status: '400',
    });

    const dbRefresh = await db
      .collection<IssueDetails>('issueDetails')
      .findOne({ githubIssueNumber: 123 });
    expect(dbRefresh?.refreshStatus).toBe(RefreshStatus.PENDING);
  });

  it('should return 400 when signature verification fails (invalid signature format)', async () => {
    const details = { id: '123', allocatorType: 'AMA', result: 'reject', finalDataCap: 0 };
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: metaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature: '0xinvalid_signature_format',
      });

    expect(response.body).toStrictEqual({
      message: 'Evm signature verification failed: signature missing v and recoveryParam',
      status: '400',
    });

    const dbRefresh = await db
      .collection<IssueDetails>('issueDetails')
      .findOne({ githubIssueNumber: 123 });
    expect(dbRefresh?.refreshStatus).toBe(RefreshStatus.PENDING);
  });

  it('should return 403 when signature verification fails (wrong message)', async () => {
    const details = { id: '123', allocatorType: 'AMA', result: 'reject', finalDataCap: 0 };
    const wrongMessage = 'Wrong message to sign';
    const signature = await metaAllocatorWallet.signMessage(wrongMessage);
    const response = await request(app)
      .post('/api/v1/ma/123/reject')
      .send({
        result: 'reject',
        details: {
          reviewerAddress: metaAllocatorWallet.address,
          reviewerPublicKey: 'fixturePublicKey',
          ...details,
        },
        signature,
      });

    expect(response.body).toStrictEqual({
      message: 'Signature verification failure.',
      status: '400',
    });

    const dbRefresh = await db
      .collection<IssueDetails>('issueDetails')
      .findOne({ githubIssueNumber: 123 });
    expect(dbRefresh?.refreshStatus).toBe(RefreshStatus.PENDING);
  });
});
