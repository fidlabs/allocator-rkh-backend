import { Container } from 'inversify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleService } from './role.service';
import { TYPES } from '@src/types';
import { MetaAllocatorService } from './meta-allocator.service';
import { GovernanceConfig, MetaAllocatorConfig } from '@src/infrastructure/interfaces';

vi.mock(import('@src/config'), async importOriginal => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual.default,
      RKH_ADDRESSES: ['f10000'],
    },
  };
});
describe('RoleService', () => {
  let container: Container;
  let service: RoleService;

  const governanceConfigMock = { addresses: ['0x456'] };
  const metaAllocatorConfigMock = { signers: ['0x789'] };
  const metaAllocatorServiceMock = { getSigners: vi.fn() };

  beforeEach(() => {
    container = new Container();
    container.bind<RoleService>(TYPES.RoleService).to(RoleService);
    container
      .bind<GovernanceConfig>(TYPES.GovernanceConfig)
      .toConstantValue(governanceConfigMock as unknown as GovernanceConfig);
    container
      .bind<MetaAllocatorConfig>(TYPES.MetaAllocatorConfig)
      .toConstantValue(metaAllocatorConfigMock as unknown as MetaAllocatorConfig);
    container
      .bind<MetaAllocatorService>(TYPES.MetaAllocatorService)
      .toConstantValue(metaAllocatorServiceMock as unknown as MetaAllocatorService);
    service = container.get<RoleService>(TYPES.RoleService);

    metaAllocatorServiceMock.getSigners.mockReturnValue(['0x9999']);
  });

  it.each`
    address     | expected
    ${'0x123'}  | ${'USER'}
    ${'0x456'}  | ${'GOVERNANCE_TEAM'}
    ${'0x789'}  | ${'METADATA_ALLOCATOR'}
    ${'0x9999'} | ${'METADATA_ALLOCATOR'}
    ${'f10000'} | ${'ROOT_KEY_HOLDER'}
  `('should return $expected for $address', ({ address, expected }) => {
    const result = service.getRole(address);
    expect(result).toBe(expected);
  });
});
