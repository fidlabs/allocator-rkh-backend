interface User {
  userId: number;
  name: string;
}

export enum AuditOutcome {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  GRANTED = 'GRANTED',
  MATCH = 'MATCH',
  REJECTED = 'REJECTED',
  DOUBLE = 'DOUBLE',
  THROTTLE = 'THROTTLE',
  UNKNOWN = 'UNKNOWN',
}

export enum RefreshStatus {
  DC_ALLOCATED = 'DC_ALLOCATED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
  SIGNED_BY_RKH = 'SIGNED_BY_RKH',
  APPROVED = 'APPROVED',
}

export const FINISHED_AUDIT_OUTCOMES = [
  AuditOutcome.DOUBLE,
  AuditOutcome.GRANTED,
  AuditOutcome.REJECTED,
  AuditOutcome.THROTTLE,
];

export const PENDING_AUDIT_OUTCOMES = [AuditOutcome.PENDING, AuditOutcome.APPROVED];

export const FINISHED_REFRESH_STATUSES = [RefreshStatus.DC_ALLOCATED, RefreshStatus.REJECTED];

export const PENDING_REFRESH_STATUSES = [
  RefreshStatus.PENDING,
  RefreshStatus.APPROVED,
  RefreshStatus.SIGNED_BY_RKH,
];

export type AuditHistory = {
  auditChange: Partial<AuditData>;
  branchName: string;
  commitSha: string;
  prNumber: number;
  prUrl: string;
};

export type AuditData = {
  started: string;
  ended: string;
  dcAllocated: string;
  outcome: AuditOutcome;
  datacapAmount: number | '';
};

export interface RkhPhase {
  messageId: number;
  approvals: string[];
}

export interface MetaAllocator {
  blockNumber: number;
}

export interface IssueDetails {
  githubIssueId: number;
  githubIssueNumber: number;
  title: string;
  creator: User;
  assignees: User[] | null;
  labels: string[] | null;
  state: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  closedAt: Date | null;
  jsonNumber: string;
  msigAddress?: string;
  metapathwayType?: string;
  maAddress?: string;
  refreshStatus?: 'DC_ALLOCATED' | 'REJECTED' | 'PENDING' | 'SIGNED_BY_RKH' | 'APPROVED';
  actorId?: string;
  transactionCid?: string;
  blockNumber?: number;
  dataCap?: number;
  rkhPhase?: RkhPhase;
  metaAllocator?: MetaAllocator;
  auditHistory?: AuditHistory[];
}
