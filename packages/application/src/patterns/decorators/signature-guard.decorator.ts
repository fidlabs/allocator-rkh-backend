import { Response } from 'express';
import { badRequest } from '@src/api/http/processors/response';
import { verifyEvmSignature, verifyLedgerPoP } from '@src/api/http/controllers/authutils';
import { HandlerDecorator } from 'inversify-express-utils';
import { GovernanceReviewDto } from '@src/application/dtos/GovernanceReviewDto';

interface MessageFactoryProps {
  result: string;
  id: string;
  finalDataCap: number;
  allocatorType: string;
}

export enum WalletType {
  Ledger = 'ledger',
  Filsnap = 'filsnap',
  MetaMask = 'metamask',
}

export enum SignatureType {
  RefreshReview = 'refreshReview',
  ApproveGovernanceReview = 'approveGovernanceReview',
  KycOverride = 'kycOverride',
  KycRevoke = 'kycRevoke',
  MetaAllocatorReject = 'metaAllocatorReject',
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
  [SignatureType.MetaAllocatorReject]: ({ id, allocatorType }: MessageFactoryProps) =>
    `Meta Allocator reject ${id} ${allocatorType}`,
};

export function SignatureGuard(
  signatureType: SignatureType,
  walletType: WalletType = WalletType.Ledger,
): HandlerDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor | unknown,
  ) {
    const desc = descriptor as PropertyDescriptor;
    const originalMethod = desc.value;
    const verifyMethodByWalletType = {
      [WalletType.Ledger]: verifyLedgerPoP,
      [WalletType.Filsnap]: verifyLedgerPoP,
      [WalletType.MetaMask]: verifyEvmSignature,
    };

    desc.value = async function (
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
        const verified = await verifyMethodByWalletType[walletType](
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
    return desc;
  };
}
