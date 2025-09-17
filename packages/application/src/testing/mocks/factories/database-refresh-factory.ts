import { faker } from '@faker-js/faker';
import {
  AuditData,
  AuditHistory,
  AuditOutcome,
  IssueDetails,
} from '@src/infrastructure/repositories/issue-details';

export class DatabaseRefreshFactory {
  static create(overrides: Partial<IssueDetails> = {}): IssueDetails {
    return {
      githubIssueId: faker.number.int(),
      githubIssueNumber: faker.number.int(),
      title: `[DataCap Refresh] ${faker.company.name()}`,
      creator: {
        userId: faker.number.int(),
        name: faker.internet.username(),
      },
      assignees: faker.helpers.multiple(
        () => ({
          userId: faker.number.int(),
          name: faker.internet.username(),
        }),
        { count: 2 },
      ),
      labels: faker.helpers.multiple(() => faker.word.sample(), { count: 3 }),
      state: 'open',
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      closedAt: null,
      jsonNumber: faker.string.numeric(5),
      msigAddress: `f2${faker.string.alphanumeric(38)}`,
      metapathwayType: faker.helpers.arrayElement(['RKH', 'MDMA']),
      refreshStatus: 'PENDING',
      dataCap: faker.number.int({ min: 1, max: 50 }),
      actorId: `f0${faker.string.numeric(7)}`,
      maAddress: `f4${faker.string.alphanumeric(38)}`,
      ...overrides,
    };
  }

  static createWithAudit(outcome: AuditOutcome, overrides?: Partial<IssueDetails>): IssueDetails {
    const lastAudit = DatabaseRefreshAuditFactory.finishedAudit(AuditOutcome.GRANTED);
    const currentAudit = DatabaseRefreshAuditFactory.create(outcome);

    return {
      ...this.create(overrides),
      lastAudit,
      currentAudit,
      auditHistory: [
        DatabaseRefreshAuditFactory.createPublisherResponse(lastAudit),
        DatabaseRefreshAuditFactory.createPublisherResponse(currentAudit),
      ],
    };
  }
}

export class DatabaseRefreshAuditFactory {
  static createPublisherResponse(
    overrides: AuditOutcome | AuditData,
    gitubOverrides: Partial<Exclude<AuditHistory, 'auditChange'>> = {},
  ): AuditHistory {
    const audit = Object.values(AuditOutcome).includes(overrides as AuditOutcome)
      ? this.create(overrides as AuditOutcome)
      : (overrides as AuditData);

    return {
      auditChange: audit,
      branchName: faker.string.alphanumeric(10),
      commitSha: faker.string.alphanumeric(10),
      prNumber: faker.number.int(),
      prUrl: faker.internet.url(),
      ...gitubOverrides,
    };
  }

  static create(outcome: AuditOutcome): AuditData {
    const map = {
      [AuditOutcome.PENDING]: this.newAudit(),
      [AuditOutcome.APPROVED]: this.approvedAudit(),
      [AuditOutcome.REJECTED]: this.rejectedAudit(),
      [AuditOutcome.GRANTED]: this.finishedAudit(AuditOutcome.GRANTED),
      [AuditOutcome.DOUBLE]: this.finishedAudit(AuditOutcome.DOUBLE),
      [AuditOutcome.THROTTLE]: this.finishedAudit(AuditOutcome.THROTTLE),
      [AuditOutcome.MATCH]: this.finishedAudit(AuditOutcome.MATCH),
      [AuditOutcome.UNKNOWN]: this.finishedAudit(AuditOutcome.UNKNOWN),
    };

    return map[outcome];
  }

  static newAudit(): AuditData {
    return {
      started: faker.date.past().toISOString(),
      ended: '',
      dcAllocated: '',
      outcome: AuditOutcome.PENDING,
      datacapAmount: '',
    };
  }

  static approvedAudit(): AuditData {
    return {
      ...this.newAudit(),
      ended: faker.date.recent().toISOString(),
      outcome: AuditOutcome.APPROVED,
      datacapAmount: faker.number.int({ min: 1, max: 50 }),
    };
  }

  static rejectedAudit(): AuditData {
    return {
      ...this.newAudit(),
      ended: faker.date.recent().toISOString(),
      outcome: AuditOutcome.REJECTED,
      datacapAmount: '',
    };
  }

  static finishedAudit(outcome: AuditOutcome): AuditData {
    return {
      ...this.newAudit(),
      ...this.approvedAudit(),
      dcAllocated: faker.date.recent().toISOString(),
      datacapAmount: faker.number.int({ min: 1, max: 50 }),
      outcome,
    };
  }
}
