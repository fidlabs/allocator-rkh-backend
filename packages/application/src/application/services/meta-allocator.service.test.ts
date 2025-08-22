import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaAllocatorService } from './meta-allocator.service';
import { Container } from 'inversify';
import {
  IMetaAllocatorRepository,
  MetaAllocatorName,
} from '@src/infrastructure/repositories/meta-allocator.repository';
import { TYPES } from '@src/types';

describe('MetaAllocatorService', () => {
  let container: Container;
  let service: MetaAllocatorService;

  const fixtureMetaAllocators = [
    {
      name: 'MDMA',
      ethAddress: '0x1',
      filAddress: 'f1',
      ethSafeAddress: '0x2',
      filSafeAddress: 'f2',
      signers: ['0x3'],
    },
  ];

  const metaAllocatorRepositoryMock = {
    getAll: vi.fn(),
    getByName: vi.fn(),
  };

  beforeEach(() => {
    container = new Container();
    container
      .bind<IMetaAllocatorRepository>(TYPES.MetaAllocatorRepository)
      .toConstantValue(metaAllocatorRepositoryMock as unknown as IMetaAllocatorRepository);

    container.bind<MetaAllocatorService>(TYPES.MetaAllocatorService).to(MetaAllocatorService);

    service = container.get<MetaAllocatorService>(TYPES.MetaAllocatorService);

    metaAllocatorRepositoryMock.getAll.mockReturnValue(fixtureMetaAllocators);
    metaAllocatorRepositoryMock.getByName.mockReturnValue(fixtureMetaAllocators[0]);
  });

  it('getAll should return list from repository', () => {
    const result = service.getAll();

    expect(result).toBe(fixtureMetaAllocators);
    expect(metaAllocatorRepositoryMock.getAll).toHaveBeenCalledTimes(1);
  });

  it('getByName should return meta allocator by name', () => {
    const result = service.getByName(MetaAllocatorName.MDMA);

    expect(result).toBe(fixtureMetaAllocators[0]);
    expect(metaAllocatorRepositoryMock.getByName).toHaveBeenCalledTimes(1);
  });
});
