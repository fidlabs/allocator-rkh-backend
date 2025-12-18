import { Db } from 'mongodb';
import { Container } from 'inversify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestContainerBuilder } from '@mocks/builders';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@src/testing/mocks/factories/database-refresh-factory';
import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';

describe('IssueDetailsRepository (e2e)', () => {
  let db: Db;
  let repository: IIssueDetailsRepository;
  let container: Container;

  const collectionName = 'issueDetails';

  const fixtureIssues = [
    DatabaseRefreshFactory.create({
      msigAddress: 'f211111',
      actorId: 'f0111111',
      refreshStatus: RefreshStatus.PENDING,
    }),
    DatabaseRefreshFactory.create({
      msigAddress: 'f222222',
      actorId: 'f0222222',
      rkhPhase: {
        approvals: ['0x123'],
        messageId: 123,
      },
      refreshStatus: RefreshStatus.SIGNED_BY_RKH,
    }),
    DatabaseRefreshFactory.create({
      msigAddress: 'f233333',
      actorId: 'f0333333',
      refreshStatus: RefreshStatus.APPROVED,
    }),
    DatabaseRefreshFactory.create({
      msigAddress: 'f244444',
      actorId: 'f0444444',
      refreshStatus: RefreshStatus.REJECTED,
    }),
    DatabaseRefreshFactory.create({
      msigAddress: 'f255555',
      actorId: 'f0555555',
      refreshStatus: RefreshStatus.DC_ALLOCATED,
    }),
  ];

  beforeAll(async () => {
    const testBuilder = new TestContainerBuilder();
    await testBuilder.withDatabase();
    const testSetup = testBuilder.withLogger().withRepositories().build();

    container = testSetup.container;
    db = testSetup.db;

    repository = container.get<IIssueDetailsRepository>(TYPES.IssueDetailsRepository);
  });

  afterAll(async () => {
    if (db) {
      await db.collection(collectionName).deleteMany({});
    }
  });

  afterEach(async () => {
    await db.collection(collectionName).deleteMany({});
  });

  beforeEach(async () => {
    await db.collection(collectionName).insertMany(fixtureIssues);
  });

  describe('findSignedBy', () => {
    it('should return the signed issue', async () => {
      const issue = await repository.findSignedBy({ 'rkhPhase.messageId': 123 });
      expect(issue).toEqual(fixtureIssues[1]);
    });

    it('should return null if no issue is found', async () => {
      const issue = await repository.findSignedBy({ 'rkhPhase.messageId': 999 });
      expect(issue).toBeNull();
    });
  });

  describe('findPendingBy', () => {
    it('should return the pending issue', async () => {
      const issue = await repository.findPendingBy({ msigAddress: 'f211111' });
      expect(issue).toEqual(fixtureIssues[0]);
    });

    it('should return null if no issue is found', async () => {
      const issue = await repository.findPendingBy({ msigAddress: 'f2999999' });
      expect(issue).toBeNull();
    });
  });

  describe('findApprovedBy', () => {
    it('should return the approved issue', async () => {
      const issue = await repository.findApprovedBy({ actorId: 'f0333333' });
      expect(issue).toEqual(fixtureIssues[2]);
    });

    it('should return null if no issue is found', async () => {
      const issue = await repository.findApprovedBy({ actorId: 'f0999999' });
      expect(issue).toBeNull();
    });
  });

  describe('findBy', () => {
    it('should return the issue by the given field', async () => {
      const issue = await repository.findBy('actorId', 'f0111111');
      expect(issue).toEqual(fixtureIssues[0]);
    });

    it('should return null if no issue is found', async () => {
      const issue = await repository.findBy('actorId', 'f0999999');
      expect(issue).toBeNull();
    });
  });

  describe('findLatestBy', () => {
    it('should return the latest issue by the given field', async () => {
      const issue = await repository.findLatestBy('actorId', 'f0111111');
      expect(issue).toEqual(fixtureIssues[0]);
    });

    it('should return null if no issue is found', async () => {
      const issue = await repository.findLatestBy('actorId', 'f0999999');
      expect(issue).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all issues', async () => {
      const issues = await repository.getAll();
      expect(issues).toEqual(fixtureIssues);
    });
  });
});
