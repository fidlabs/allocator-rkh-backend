export interface GovernanceReviewDetailsDto {
  reviewerAddress: string;
  reviewerPublicKey: string;
  finalDataCap: number;
  allocatorType: string;
}

export interface GovernanceReviewDto {
  result: string;
  details: GovernanceReviewDetailsDto;
  signature: string;
}
