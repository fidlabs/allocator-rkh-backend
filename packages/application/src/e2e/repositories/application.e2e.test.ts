import 'reflect-metadata';
import { beforeAll, afterAll, beforeEach, describe, expect, it, afterEach } from 'vitest';
import * as dotenv from 'dotenv';
import { TestContainerBuilder } from '@mocks/builders';
import { TYPES } from '@src/types';
import { Db } from 'mongodb';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import { ApplicationStatus } from '@src/domain/application/application';
import { Container } from 'inversify';
import { ApplicationDetails } from '@src/infrastructure/repositories/application-details.types';
import { faker } from '@faker-js/faker';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.test' });

const createMockApplicationDetails = (
  overrides: Partial<ApplicationDetails> = {},
): ApplicationDetails => ({
  id: faker.string.uuid(),
  number: faker.number.int({ min: 1000, max: 9999 }),
  name: faker.person.fullName(),
  organization: faker.company.name(),
  actorId: `f0${faker.string.numeric(7)}`,
  address: `f2${faker.string.alphanumeric(38)}`,
  github: `${faker.internet.username()}`,
  allocationTrancheSchedule: faker.lorem.sentence(),
  datacap: faker.number.int({ min: 1, max: 100 }),
  status: ApplicationStatus.KYC_PHASE,
  ...overrides,
});

describe.only('ApplicationDetailsRepository (e2e)', () => {
  let db: Db;
  let repository: IApplicationDetailsRepository;
  let container: Container;

  const collectionName = 'applicationDetails';
  const actorId = 'f0123456';
  const address = 'f2123456';
  const fixtureApplications = [
    createMockApplicationDetails({
      status: ApplicationStatus.DC_ALLOCATED,
      actorId,
      address,
    }),
    createMockApplicationDetails({
      status: ApplicationStatus.REJECTED,
      actorId,
      address,
    }),
    createMockApplicationDetails({
      status: ApplicationStatus.KYC_PHASE,
      actorId,
      address,
    }),
  ];

  beforeAll(async () => {
    const testBuilder = new TestContainerBuilder();
    await testBuilder.withDatabase();
    const testSetup = testBuilder.withLogger().withRepositories().build();

    container = testSetup.container;
    db = testSetup.db;

    repository = container.get<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository);
  });

  afterAll(async () => {
    if (db) {
      await db.collection(collectionName).deleteMany({});
    }
  });

  beforeEach(async () => {
    await db.collection(collectionName).insertMany(fixtureApplications);
  });

  afterEach(async () => {
    await db.collection(collectionName).deleteMany({});
  });

  describe('getPendingBy', () => {
    it('getPendingBy should return pending application by actorId', async () => {
      const kycPhaseApplication = fixtureApplications.find(
        application => application.status === ApplicationStatus.KYC_PHASE,
      );

      const result = await repository.getPendingBy('actorId', actorId);

      expect(result).toEqual(kycPhaseApplication);
      expect(result?.actorId).toBe(actorId);
      expect(result?.status).not.toBe(ApplicationStatus.DC_ALLOCATED);
      expect(result?.status).not.toBe(ApplicationStatus.REJECTED);
    });

    it('getPendingBy should return pending application by address', async () => {
      const kycPhaseApplication = fixtureApplications.find(
        application => application.status === ApplicationStatus.KYC_PHASE,
      );

      const result = await repository.getPendingBy('address', address);

      expect(result).toEqual(kycPhaseApplication);
      expect(result?.address).toBe(address);
      expect(result?.status).not.toBe(ApplicationStatus.DC_ALLOCATED);
      expect(result?.status).not.toBe(ApplicationStatus.REJECTED);
    });

    it('getPendingBy should return null if no application is found', async () => {
      const result = await repository.getPendingBy('actorId', 'not-found');

      expect(result).toBeNull();
    });
  });

  describe('getByActorId', () => {
    it('should return first matching application', async () => {
      const firstItem = fixtureApplications[0];

      const result = await repository.getByActorId(actorId);

      expect(result).toEqual(firstItem);
    });

    it('should return null if no application is found', async () => {
      const result = await repository.getByActorId('not-found');

      expect(result).toBeNull();
    });
  });
});
