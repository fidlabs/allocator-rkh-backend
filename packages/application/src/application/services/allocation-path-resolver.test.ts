import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '@src/types';
import { AllocationPathResolver } from './allocation-path-resolver';
import { AllocatorType } from '@src/domain/types';
import { Logger } from 'ethers/lib/utils';
import { MetaAllocatorService } from './meta-allocator.service';
import { RkhConfig } from '@src/infrastructure/interfaces';

describe('AllocationPathResolver', () => {
  let container: Container;
  let service: AllocationPathResolver;

  const loggerMock = { info: vi.fn(), error: vi.fn() } as unknown as Logger;

  const metaAllocatorServiceMock = {
    getByName: vi.fn(name => ({ filAddress: `f for ${name}` })),
  };

  const rkhConfigMock = {
    rkhAddress: '0x1',
    rkhThreshold: 1,
  } as unknown as RkhConfig;

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock);
    container
      .bind<MetaAllocatorService>(TYPES.MetaAllocatorService)
      .toConstantValue(metaAllocatorServiceMock as unknown as MetaAllocatorService);

    container
      .bind<RkhConfig>(TYPES.RkhConfig)
      .toConstantValue(rkhConfigMock as unknown as RkhConfig);

    container.bind<AllocationPathResolver>(TYPES.AllocationPathResolver).to(AllocationPathResolver);

    service = container.get<AllocationPathResolver>(TYPES.AllocationPathResolver);
  });

  it('should resolve MDMA allocation path', () => {
    const result = service.resolve(AllocatorType.MDMA);

    expect(result).toStrictEqual({
      address: 'f for MDMA',
      pathway: 'MDMA',
      auditType: 'Enterprise',
      isMetaAllocator: true,
    });
  });

  it('should resolve ORMA allocation path', () => {
    const result = service.resolve(AllocatorType.ORMA);

    expect(result).toStrictEqual({
      address: 'f for ORMA',
      pathway: 'ORMA',
      auditType: 'On Ramp',
      isMetaAllocator: true,
    });
  });

  it('should resolve RKH allocation path', () => {
    const result = service.resolve(AllocatorType.RKH);

    expect(result).toStrictEqual({
      address: rkhConfigMock.rkhAddress,
      pathway: 'RKH',
      auditType: 'Market Based',
      isMetaAllocator: false,
    });
  });

  it('should resolve AMA allocation path', () => {
    const result = service.resolve(AllocatorType.AMA);

    expect(result).toStrictEqual({
      address: 'f for AMA',
      pathway: 'AMA',
      auditType: 'Automated',
      isMetaAllocator: true,
    });
  });
});
