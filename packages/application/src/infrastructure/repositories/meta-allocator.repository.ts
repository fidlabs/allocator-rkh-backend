import { injectable } from 'inversify';

export interface MetaAllocator {
  readonly name: string;
  readonly signers: readonly string[];
  readonly ethAddress: string;
  readonly ethSafeAddress: string;
  readonly filAddress: string;
  readonly filSafeAddress: string;
}

export interface IMetaAllocatorRepository {
  getAll(): readonly MetaAllocator[];

  getByName(name: MetaAllocatorName): MetaAllocator;
}

// TODO - rework this and relate to AllocatorType and Pathway enums
export enum MetaAllocatorName {
  MDMA = 'MDMA',
  ORMA = 'ORMA',
  AMA = 'AMA',
}

@injectable()
export class MetaAllocatorRepository implements IMetaAllocatorRepository {
  private readonly metaAllocators: Record<MetaAllocatorName, MetaAllocator> = {
    [MetaAllocatorName.MDMA]: {
      name: MetaAllocatorName.MDMA,
      ethAddress: '0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d',
      filAddress: 'f410fw325e6novwl57jcsbhz6koljylxuhqq5jnp5ftq',
      ethSafeAddress: '0x2e25A2f6bC2C0b7669DFB25180Ed57e07dAabe9e',
      filSafeAddress: 'f410ffys2f5v4fqfxm2o7wjiyb3kx4b62vpu66gmu7ia',
      signers: [
        '0x106A371ab66ACA71753757eBD9Bb0a323e055229',
        '0xDABAe878B6D1045a9417Eaf2cc4280Dbc510f3f6',
        '0x5E9e7a90732c666EFB39B17Cf1C2af7E72d7EE90',
        '0xd697365CFEF16cF29477aFe7E4a3d5f452f83383',
      ],
    },
    [MetaAllocatorName.ORMA]: {
      name: MetaAllocatorName.ORMA,
      ethAddress: '0xE896C15F5120A07C2481e0fcf3d008E1C9E76C1f',
      filAddress: 'f410f5clmcx2recqhyjeb4d6phuai4he6o3a77guvfny',
      ethSafeAddress: '0xfeaCBca666CA237F01F0B192fB9F43D61F32F41a',
      filSafeAddress: 'f410f72wlzjtgzirx6apqwgjpxh2d2yptf5a2f6ns7gi',
      signers: [
        '0x7285B7D3248fde1cCF9E087993fdfC79EC54b54a',
        '0xDABAe878B6D1045a9417Eaf2cc4280Dbc510f3f6',
        '0x5E9e7a90732c666EFB39B17Cf1C2af7E72d7EE90',
      ],
    },
    [MetaAllocatorName.AMA]: {
      name: MetaAllocatorName.AMA,
      ethAddress: '0x984376Abd1FF5518B6aE9d065C40696Ae916dc88',
      filAddress: 'f410ftbbxnk6r75krrnvotudfyqdjnlurnxei735ruja',
      ethSafeAddress: '0xe6A3b5afFc95f8dA2cf618BAd7C63311aBCeDa1d',
      filSafeAddress: 'f410f42r3ll74sx4nulhwdc5nprrtcgv45wq5rwcsh3y',
      signers: [
        '0x106A371ab66ACA71753757eBD9Bb0a323e055229',
        '0xd697365CFEF16cF29477aFe7E4a3d5f452f83383',
        '0x5E9e7a90732c666EFB39B17Cf1C2af7E72d7EE90',
      ],
    },
    // EPMA: {
    //   name: 'EPMA',
    //   ethAddress: '0x1e15357F252FF44d2CebEA99FDB1E0858018cCE1',
    //   filAddress: 'f410fdyktk7zff72e2lhl5km73mpaqwabrthbajj3l5q',
    //   ethSafeAddress: '0x8AaDA793DB9dF62ba4703F16c73a2E14949B0AE8',
    //   filSafeAddress: 'f410frkw2pe63tx3cxjdqh4lmoorocskjwcxidsi7c3i',
    //   signers: [
    //     '0x7285B7D3248fde1cCF9E087993fdfC79EC54b54a',
    //     '0xDABAe878B6D1045a9417Eaf2cc4280Dbc510f3f6',
    //   ],
    // },
  };

  getAll(): readonly MetaAllocator[] {
    return Object.values(this.metaAllocators);
  }

  getByName(name: MetaAllocatorName): MetaAllocator {
    return this.metaAllocators[name];
  }
}
