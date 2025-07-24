import { injectable } from 'inversify';

export interface IDataCapMapper {
  fromBigIntBytesToPiBNumber(datacapBytes: bigint): number;

  fromBufferBytesToBigIntBytes(datacap: Buffer | string): bigint;

  fromBufferBytesToPiBNumber(datacap: Buffer | string): number;
}

@injectable()
export class DataCapMapper implements IDataCapMapper {
  private PiBValueInBytes = BigInt('1125899906842624');

  fromBufferBytesToPiBNumber(datacap: Buffer | string): number {
    return this.fromBigIntBytesToPiBNumber(this.fromBufferBytesToBigIntBytes(datacap));
  }

  fromBufferBytesToBigIntBytes(datacap: Buffer | string): bigint {
    return Buffer.isBuffer(datacap)
      ? BigInt('0x' + datacap.toString('hex'))
      : BigInt(datacap.toString());
  }

  fromBigIntBytesToPiBNumber(datacapBytes: bigint): number {
    const integerFromDivision = datacapBytes / this.PiBValueInBytes;
    const remainder = datacapBytes % this.PiBValueInBytes;
    const fraction = Number(remainder) / Number(this.PiBValueInBytes);

    return Number(integerFromDivision) + fraction;
  }
}
