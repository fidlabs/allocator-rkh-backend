import { inject, injectable } from 'inversify';
import config from '@src/config';
import { GovernanceConfig } from '@src/infrastructure/interfaces';
import { TYPES } from '@src/types';

const RKH_ADDRESSES = config.RKH_ADDRESSES;
const MA_ADDRESSES = config.MA_ADDRESSES;

@injectable()
export class RoleService {
  constructor(
    @inject(TYPES.GovernanceConfig) private readonly governanceConfig: GovernanceConfig,
  ) {}
  getRole(address: string): string {
    let role = 'USER';
    if (this.governanceConfig.addresses.includes(address.toLowerCase())) {
      role = 'GOVERNANCE_TEAM';
    } else if (RKH_ADDRESSES.includes(address.toLowerCase())) {
      role = 'ROOT_KEY_HOLDER';
    } else if (MA_ADDRESSES.includes(address.toLowerCase())) {
      role = 'METADATA_ALLOCATOR';
    }

    return role;
  }
}
