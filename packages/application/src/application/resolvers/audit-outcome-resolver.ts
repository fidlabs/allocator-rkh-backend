import { injectable } from 'inversify';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';

@injectable()
export class AuditOutcomeResolver {
  resolve(auditPrevDatacap?: number | string, auditCurrentDatacap?: number | string): AuditOutcome {
    const prevDatacapAmount = Number(auditPrevDatacap);
    const currentDatacapAmount = Number(auditCurrentDatacap);
    if (!prevDatacapAmount || !currentDatacapAmount) return AuditOutcome.UNKNOWN;

    switch (true) {
      case prevDatacapAmount === currentDatacapAmount:
        return AuditOutcome.MATCH;
      case prevDatacapAmount && prevDatacapAmount * 2 === currentDatacapAmount:
        return AuditOutcome.DOUBLE;
      case prevDatacapAmount && prevDatacapAmount / 2 === currentDatacapAmount:
        return AuditOutcome.THROTTLE;
      default:
        return AuditOutcome.UNKNOWN;
    }
  }
}
