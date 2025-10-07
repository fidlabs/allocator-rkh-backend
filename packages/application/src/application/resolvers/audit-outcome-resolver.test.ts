import { describe, it, expect, beforeEach } from 'vitest';
import { AuditOutcomeResolver } from './audit-outcome-resolver';
import { AuditOutcome } from '@src/infrastructure/repositories/issue-details';
import { Container } from 'inversify';
import { TYPES } from '@src/types';

describe('AuditOutcomeResolver', () => {
  let container: Container;
  let service: AuditOutcomeResolver;

  beforeEach(() => {
    container = new Container();
    container.bind<AuditOutcomeResolver>(TYPES.AuditOutcomeResolver).to(AuditOutcomeResolver);

    service = container.get<AuditOutcomeResolver>(TYPES.AuditOutcomeResolver);
  });

  it.each`
    prevDatacap | currentDatacap | expected
    ${10}       | ${10}          | ${AuditOutcome.MATCH}
    ${10}       | ${20}          | ${AuditOutcome.DOUBLE}
    ${10}       | ${5}           | ${AuditOutcome.THROTTLE}
    ${0}        | ${7}           | ${AuditOutcome.UNKNOWN}
    ${10}       | ${0}           | ${AuditOutcome.UNKNOWN}
    ${7}        | ${8}           | ${AuditOutcome.UNKNOWN}
    ${8}        | ${7}           | ${AuditOutcome.UNKNOWN}
  `(
    'returns $expected when prevDatacap is $prevDatacap and currentDatacap is $currentDatacap',
    ({ prevDatacap, currentDatacap, expected }) => {
      expect(service.resolve(prevDatacap, currentDatacap)).toBe(expected);
    },
  );
});
