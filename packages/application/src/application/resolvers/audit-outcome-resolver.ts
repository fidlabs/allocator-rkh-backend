import { injectable } from 'inversify';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { AuditCycle } from '../services/pull-request.types';

@injectable()
export class AuditOutcomeResolver {
  resolve(prevAudit: AuditCycle, currentAudit: AuditCycle): AuditOutcome {
    const prevDatacap = prevAudit.datacap_amount;
    const currentDatacap = currentAudit.datacap_amount;

    switch (true) {
      case prevDatacap === currentDatacap:
        return AuditOutcome.GRANTED;
      case prevDatacap && prevDatacap * 2 === currentDatacap:
        return AuditOutcome.DOUBLE;
      case prevDatacap && prevDatacap / 2 === currentDatacap:
        return AuditOutcome.THROTTLE;
      default:
        return AuditOutcome.UNKNOWN;
    }
  }
}
