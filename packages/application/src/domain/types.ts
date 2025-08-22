import { Pathway } from '@src/application/services/allocation-path-resolver';

type KYCResultData = {
  // IDs
  id: string;
  kycInquiryId: string;

  // Metadata
  createdAt: string;
  tenantId: string;
  documentId: string;
  documentType: string;
  platform: string;
  browser: string;

  // Scores
  scoreDocumentTotal: number;
  scoreBiometricLifeProof: number;
  scoreBiometricSelfie: number;
  scoreBiometricPhotoId: number;
  scoreBiometricDuplicateAttack: number;

  // Other
  processCode: string;
  processMessage: string;
};

export type KYCApprovedData = KYCResultData;
export type KYCRejectedData = KYCApprovedData;

export enum AuditType {
  Enterprise = 'Enterprise',
  MarketBased = 'Market Based',
  Automated = 'Automated',
  OnRamp = 'On Ramp',
}

export enum AllocatorType {
  MDMA = 'MDMA',
  ODMA = 'ODMA',
  RKH = 'RKH',
  AMA = 'AMA',
}

export type AllocationPath = {
  pathway: Pathway;
  address: string;
  auditType: AuditType;
  isMetaAllocator: boolean;
};

export type GovernanceReviewApprovedData = {
  finalDataCap: number;
  allocationType: AllocatorType;
  reviewerAddress: string;
  isMDMAAllocator?: boolean;
};

export type GovernanceReviewRejectedData = {
  reason: string;
  reviewerAddress: string;
  isMDMAAllocator?: boolean;
};
