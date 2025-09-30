import { Response } from 'express';
import { badRequest } from '@src/api/http/processors/response';
import { verifyLedgerPoP } from '@src/api/http/controllers/authutils';
import { HandlerDecorator } from 'inversify-express-utils';
import { GovernanceReviewDto } from '@src/application/dtos/GovernanceReviewDto';

interface MessageFactoryProps {
  result: string;
  id: string;
  finalDataCap: number;
  allocatorType: string;
}

export enum SignatureType {
  RefreshReview = 'refreshReview',
  ApproveGovernanceReview = 'approveGovernanceReview',
  KycOverride = 'kycOverride',
  KycRevoke = 'kycRevoke',
}

export const messageFactoryByType = {
  [SignatureType.RefreshReview]: ({
    result,
    id,
    finalDataCap,
    allocatorType,
  }: MessageFactoryProps) => `Governance refresh ${result} ${id} ${finalDataCap} ${allocatorType}`,
  [SignatureType.ApproveGovernanceReview]: ({
    result,
    id,
    finalDataCap,
    allocatorType,
  }: MessageFactoryProps) => `Governance ${result} ${id} ${finalDataCap} ${allocatorType}`,
  [SignatureType.KycOverride]: ({ id }: MessageFactoryProps) => `KYC Override for ${id}`,
  [SignatureType.KycRevoke]: ({ id }: MessageFactoryProps) => `KYC Revoke for ${id}`,
};

export function SignatureGuard(signatureType: SignatureType): HandlerDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      id: string,
      governanceReviewDto: GovernanceReviewDto,
      res: Response,
      ...rest: unknown[]
    ) {
      const { result, details, signature } = governanceReviewDto;
      const { reviewerPublicKey, reviewerAddress, finalDataCap, allocatorType } = details;

      const expectedPreImage = messageFactoryByType[signatureType]({
        result,
        id,
        finalDataCap: parseInt(finalDataCap),
        allocatorType,
      });

      try {
        const verified = await verifyLedgerPoP(
          reviewerAddress,
          reviewerPublicKey,
          signature,
          expectedPreImage,
        );

        if (!verified) {
          return res.status(403).json(badRequest('Signature verification failure.'));
        }
      } catch (e) {
        if (e instanceof Error) {
          return res.status(400).json(badRequest(e.message));
        }

        return res.status(400).json(badRequest('Unknown error in signature validation'));
      }

      return originalMethod.apply(this, [id, governanceReviewDto, res, ...rest]);
    };
  };
}
