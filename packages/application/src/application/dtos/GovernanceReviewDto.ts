export interface GovernanceReviewDetailsDto {
  reviewerAddress: string;
  reviewerPublicKey: string;
  finalDataCap: string;
  allocatorType: string;
}

export interface GovernanceReviewDto {
  result: string;
  details: GovernanceReviewDetailsDto;
  signature: string;
}
