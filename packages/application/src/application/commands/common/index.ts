import { Command } from '@filecoin-plus/core';
import { ApplicationStatus } from '@src/domain/application/application';

export enum PhaseStatus {
  Approved = 'approved',
  Rejected = 'rejected',
}

export type PhaseResult<A, R> =
  | { status: PhaseStatus.Approved; data: A }
  | { status: PhaseStatus.Rejected; data: R };

export class SubmitPhaseResultCommand<A, R> extends Command {
  constructor(
    public readonly allocatorId: string,
    public readonly phase: ApplicationStatus,
    public readonly result: PhaseResult<A, R>,
  ) {
    super();
  }
}

export class RevokeKYCCommand extends Command {
  constructor(
    public readonly allocatorId: string,
    public readonly phase: ApplicationStatus,
  ) {
    super();
  }
}
