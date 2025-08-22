import { inject, injectable } from 'inversify';
import { AllocatorType, AuditType } from '@src/domain/types';
import { TYPES } from '@src/types';
import { MetaAllocatorService } from './meta-allocator.service';
import { MetaAllocatorName } from '@src/infrastructure/repositories/meta-allocator.repository';
import { Logger } from '@filecoin-plus/core/src/utilities/Logger';
import { RkhConfig } from '@src/infrastructure/interfaces';
import { LOG_MESSAGES } from '@src/constants/log-messages';

export enum Pathway {
  MDMA = MetaAllocatorName.MDMA,
  ODMA = MetaAllocatorName.ODMA,
  RKH = 'RKH',
}

export type ResolveOutput = {
  isMetaAllocator: boolean;
  pathway: Pathway;
  address: string;
  auditType: AuditType;
};

const logMessages = LOG_MESSAGES.ALLOCATION_PATH_RESOLVER;

/**
 * AMA is a special case for now, it will be handled by the RKH allocator
 * update it when we have a dedicated AMA allocator.
 */
@injectable()
export class AllocationPathResolver {
  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.RkhConfig) private readonly rkhConfig: RkhConfig,
    @inject(TYPES.MetaAllocatorService) private readonly metaAllocatorService: MetaAllocatorService,
  ) {}

  resolve(allocatorType: AllocatorType): ResolveOutput {
    this.logger.info(logMessages.RESOLVING_ALLOCATION_PATHWAY, allocatorType);

    switch (allocatorType) {
      case AllocatorType.MDMA:
        return {
          isMetaAllocator: true,
          pathway: Pathway.MDMA,
          address: this.metaAllocatorService.getByName(MetaAllocatorName.MDMA).filAddress,
          auditType: AuditType.Enterprise,
        };
      case AllocatorType.ODMA:
        return {
          isMetaAllocator: true,
          pathway: Pathway.ODMA,
          address: this.metaAllocatorService.getByName(MetaAllocatorName.ODMA).filAddress,
          auditType: AuditType.OnRamp,
        };
      case AllocatorType.RKH:
        return {
          isMetaAllocator: false,
          pathway: Pathway.RKH,
          address: this.rkhConfig.rkhAddress,
          auditType: AuditType.MarketBased,
        };
      case AllocatorType.AMA:
        return {
          isMetaAllocator: false,
          pathway: Pathway.RKH,
          address: this.rkhConfig.rkhAddress,
          auditType: AuditType.Automated,
        };
      default:
        throw new Error(`Unknown allocator type: ${allocatorType}`);
    }
  }
}
