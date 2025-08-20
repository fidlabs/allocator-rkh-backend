import {
  MetaAllocator,
  MetaAllocatorRepository,
} from '@src/infrastructure/repositories/meta-allocator.repository';
import { TYPES } from '@src/types';
import { inject, injectable } from 'inversify';

export interface IMetaAllocatorService {
  getAll(): readonly MetaAllocator[];
}

@injectable()
export class MetaAllocatorService implements IMetaAllocatorService {
  constructor(
    @inject(TYPES.MetaAllocatorRepository)
    private readonly metaAllocatorRepository: MetaAllocatorRepository,
  ) {}

  getAll(): readonly MetaAllocator[] {
    return this.metaAllocatorRepository.getAll();
  }
}
