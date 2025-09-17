import { inject, injectable } from 'inversify';
import { AllocatorType, AuditType } from '@src/domain/types';
import { TYPES } from '@src/types';
import { MetaAllocatorService } from '../services/meta-allocator.service';
import { MetaAllocatorName } from '@src/infrastructure/repositories/meta-allocator.repository';
import { Logger } from '@filecoin-plus/core/src/utilities/Logger';
import { RkhConfig } from '@src/infrastructure/interfaces';
import { LOG_MESSAGES } from '@src/constants/log-messages';

// TODO Refactor to pull value from the AllocatorType enum
export enum Pathway {
  MDMA = MetaAllocatorName.MDMA,
  ORMA = MetaAllocatorName.ORMA,
  AMA = MetaAllocatorName.AMA,
  RKH = 'RKH',
}

export type ResolveOutput = {
  isMetaAllocator: boolean;
  pathway: Pathway;
  address: string;
  auditType: AuditType;
};

const logMessages = LOG_MESSAGES.ALLOCATION_PATH_RESOLVER;

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
      case AllocatorType.ORMA:
        return {
          isMetaAllocator: true,
          pathway: Pathway.ORMA,
          address: this.metaAllocatorService.getByName(MetaAllocatorName.ORMA).filAddress,
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
          isMetaAllocator: true,
          pathway: Pathway.AMA,
          address: this.metaAllocatorService.getByName(MetaAllocatorName.AMA).filAddress,
          auditType: AuditType.Automated,
        };
      default:
        throw new Error(`Unknown allocator type: ${allocatorType}`);
    }
  }
}
