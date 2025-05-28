type KYCResultData = {
  // IDs
  id: string
  kycInquiryId: string

  // Metadata
  createdAt: string
  tenantId: string
  documentId: string
  documentType: string
  platform: string
  browser: string

  // Scores
  scoreDocumentTotal: number
  scoreBiometricLifeProof: number
  scoreBiometricSelfie: number
  scoreBiometricPhotoId: number
  scoreBiometricDuplicateAttack: number

  // Other
  processCode: string
  processMessage: string
}

export type KYCApprovedData = KYCResultData
export type KYCRejectedData = KYCApprovedData

export type AllocatorType = 'Manual' | 'Automated' | 'Market Based' | 'MetaAllocator'

export type GovernanceReviewApprovedData = {
  finalDataCap: number
  allocatorType: AllocatorType
  reviewerAddress: string
  isMDMAAllocator?: boolean
}

export type GovernanceReviewRejectedData = {
  reason: string
  reviewerAddress: string
  isMDMAAllocator?: boolean
}
