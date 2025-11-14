import { inject, injectable } from 'inversify';
import config from '@src/config';
import { GovernanceConfig, MetaAllocatorConfig } from '@src/infrastructure/interfaces';
import { TYPES } from '@src/types';
import { MetaAllocatorService } from './meta-allocator.service';

const RKH_ADDRESSES = config.RKH_ADDRESSES;

@injectable()
export class RoleService {
  constructor(
    @inject(TYPES.GovernanceConfig) private readonly governanceConfig: GovernanceConfig,
    @inject(TYPES.MetaAllocatorConfig) private readonly metaAllocatorConfig: MetaAllocatorConfig,
    @inject(TYPES.MetaAllocatorService) private readonly metaAllocatorService: MetaAllocatorService,
  ) {}
  getRole(address: string): string {
    let role = 'USER';
    if (this.governanceConfig.addresses.includes(address.toLowerCase())) {
      role = 'GOVERNANCE_TEAM';
    } else if (RKH_ADDRESSES.includes(address.toLowerCase())) {
      role = 'ROOT_KEY_HOLDER';
    } else if (
      this.metaAllocatorConfig.signers.includes(address.toLowerCase()) ||
      this.metaAllocatorService.getSigners().includes(address.toLowerCase())
    ) {
      role = 'METADATA_ALLOCATOR';
    }

    return role;
  }
}
