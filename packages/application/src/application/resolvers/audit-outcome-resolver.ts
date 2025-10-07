import { injectable } from 'inversify';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';

@injectable()
export class AuditOutcomeResolver {
  resolve(prevDatacap?: number | '', currentDatacap?: number | ''): AuditOutcome {
    if (!prevDatacap || !currentDatacap) return AuditOutcome.UNKNOWN;

    switch (true) {
      case prevDatacap === currentDatacap:
        return AuditOutcome.MATCH;
      case prevDatacap && prevDatacap * 2 === currentDatacap:
        return AuditOutcome.DOUBLE;
      case prevDatacap && prevDatacap / 2 === currentDatacap:
        return AuditOutcome.THROTTLE;
      default:
        return AuditOutcome.UNKNOWN;
    }
  }
}
