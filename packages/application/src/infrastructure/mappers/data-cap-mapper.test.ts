import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from 'inversify';
import { DataCapMapper, IDataCapMapper } from './data-cap-mapper';
import { TYPES } from '@src/types';

describe('DataCapMapper', () => {
  let container: Container;
  let mapper: IDataCapMapper;

  const PIB_IN_BYTES = BigInt('1125899906842624');

  beforeEach(() => {
    container = new Container();
    container.bind<IDataCapMapper>(TYPES.DataCapMapper).to(DataCapMapper);
    mapper = container.get<IDataCapMapper>(TYPES.DataCapMapper);
  });

  describe('fromBigIntBytesToPiBNumber', () => {
    it.each`
      input                                      | expected                 | description
      ${BigInt(0)}                               | ${0}                     | ${'zero bytes should return 0 PiB'}
      ${PIB_IN_BYTES}                            | ${1}                     | ${'exactly 1 PiB in bytes should return 1 PiB'}
      ${PIB_IN_BYTES * BigInt(2)}                | ${2}                     | ${'exactly 2 PiB in bytes should return 2 PiB'}
      ${PIB_IN_BYTES * BigInt(10)}               | ${10}                    | ${'exactly 10 PiB in bytes should return 10 PiB'}
      ${PIB_IN_BYTES / BigInt(2)}                | ${0.5}                   | ${'half PiB in bytes should return 0.5 PiB'}
      ${PIB_IN_BYTES / BigInt(4)}                | ${0.25}                  | ${'quarter PiB in bytes should return 0.25 PiB'}
      ${PIB_IN_BYTES + PIB_IN_BYTES / BigInt(2)} | ${1.5}                   | ${'1.5 PiB in bytes should return 1.5 PiB'}
      ${BigInt(1024)}                            | ${9.094947017729282e-13} | ${'1 KB (1024 bytes) should return very small PiB value'}
    `('should convert $description', ({ input, expected }) => {
      const result = mapper.fromBigIntBytesToPiBNumber(input);
      if (typeof expected === 'number' && expected < 1) {
        expect(result).toBeCloseTo(expected, 15);
      } else {
        expect(result).toBe(expected);
      }
    });
  });

  describe('fromBufferBytesToBigIntBytes', () => {
    it.each`
      input                                    | expected                | description
      ${Buffer.from([0xff])}                   | ${BigInt(255)}          | ${'single byte Buffer (0xFF)'}
      ${Buffer.from([0x01, 0x00, 0x00, 0x00])} | ${BigInt('0x01000000')} | ${'4-byte Buffer'}
      ${Buffer.from([0x10])}                   | ${BigInt(16)}           | ${'single byte Buffer (0x10)'}
      ${'0'}                                   | ${BigInt(0)}            | ${'zero string'}
      ${'1000000'}                             | ${BigInt('1000000')}    | ${'decimal string'}
      ${'1125899906842624'}                    | ${PIB_IN_BYTES}         | ${'1 PiB as string'}
    `('should convert $description to BigInt', ({ input, expected }) => {
      const result = mapper.fromBufferBytesToBigIntBytes(input);
      expect(result).toBe(expected);
    });

    it('should handle empty Buffer correctly', () => {
      // Empty buffer creates '0x' which is invalid BigInt, so this might throw or need special handling
      const emptyBuffer = Buffer.from([]);
      expect(() => mapper.fromBufferBytesToBigIntBytes(emptyBuffer)).toThrow();
    });
  });

  describe('fromBufferBytesToPiBNumber', () => {
    it.each`
      input                                    | expected                  | description
      ${'0'}                                   | ${0}                      | ${'string "0" should return 0 PiB'}
      ${PIB_IN_BYTES.toString()}               | ${1}                      | ${'string representing 1 PiB should return 1 PiB'}
      ${(PIB_IN_BYTES * BigInt(2)).toString()} | ${2}                      | ${'string representing 2 PiB should return 2 PiB'}
      ${Buffer.from([0x04, 0x00])}             | ${9.094947017729282e-13}  | ${'Buffer representing 1024 bytes should return very small PiB value'}
      ${Buffer.from([0xff])}                   | ${2.2648549702353193e-13} | ${'Buffer representing 255 bytes should return very small PiB value'}
    `('should convert $description', ({ input, expected }) => {
      const result = mapper.fromBufferBytesToPiBNumber(input);
      if (typeof expected === 'number' && expected < 1) {
        expect(result).toBeCloseTo(expected, 15);
      } else {
        expect(result).toBe(expected);
      }
    });

    it('should throw error when empty buffer is passed', () => {
      const emptyBuffer = Buffer.from([]);
      expect(() => mapper.fromBufferBytesToPiBNumber(emptyBuffer)).toThrow();
    });
  });

  describe('integration and consistency tests', () => {
    it.each`
      bytes           | expectedPiB              | description
      ${'0'}          | ${0}                     | ${'zero bytes should return 0 PiB'}
      ${'1024'}       | ${9.094947017729282e-13} | ${'1 KB (1024 bytes) should return very small PiB value'}
      ${'1048576'}    | ${9.313225746154785e-10} | ${'1 MB (1048576 bytes) should return tiny PiB value'}
      ${'1073741824'} | ${9.5367431640625e-7}    | ${'1 GB (1073741824 bytes) should return small PiB value'}
    `('should convert $description', ({ bytes, expectedPiB }) => {
      const result = mapper.fromBufferBytesToPiBNumber(bytes);
      expect(result).toBeCloseTo(expectedPiB, 15);
    });
  });
});
