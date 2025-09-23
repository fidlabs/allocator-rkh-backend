import { faker } from '@faker-js/faker';

import { AuditCycle } from '@src/application/services/pull-request.types';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';

export class GithubAuditFactory {
  static create(outcome: AuditOutcome): AuditCycle {
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

  static newAudit(): AuditCycle {
    return {
      started: faker.date.past().toISOString(),
      ended: '',
      dc_allocated: '',
      outcome: AuditOutcome.PENDING,
      datacap_amount: '',
    };
  }

  static approvedAudit(): AuditCycle {
    return {
      ...this.newAudit(),
      ended: faker.date.recent().toISOString(),
      outcome: AuditOutcome.APPROVED,
      datacap_amount: faker.number.int({ min: 1, max: 50 }),
    };
  }

  static rejectedAudit(): AuditCycle {
    return {
      ...this.newAudit(),
      ended: faker.date.recent().toISOString(),
      outcome: AuditOutcome.REJECTED,
      datacap_amount: '',
    };
  }

  static finishedAudit(outcome: AuditOutcome): AuditCycle {
    return {
      ...this.newAudit(),
      ...this.approvedAudit(),
      dc_allocated: faker.date.recent().toISOString(),
      datacap_amount: faker.number.int({ min: 1, max: 50 }),
      outcome,
    };
  }
}
