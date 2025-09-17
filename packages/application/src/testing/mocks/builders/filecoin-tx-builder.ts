import { transactionSerialize } from '@zondax/filecoin-signing-tools';
import { AddressSecp256k1 } from 'iso-filecoin/address';
import { getPublicKey, signAsync } from '@noble/secp256k1';
import { blake2b } from '@noble/hashes/blake2';
import { hexToBytes } from '@noble/hashes/utils';
import cbor from 'cbor';

export interface FilecoinTx {
  address: string;
  pubKeyBase64: string;
  transaction: string;
}

export class FilecoinTxBuilder {
  challenge: string = 'challenge';
  privateKeyHex: string = '4f9c4ea3f3ee2a26d1f6a4a2f0f0b8f8e0e9a3d9e5a4b1c2d3e4f5a6b7c8d9e0';
  customMessage: object = {};
  address: string = '';

  withChallenge(challenge: string) {
    this.challenge = challenge;
    return this;
  }

  withPrivateKeyHex(privateKeyHex: string) {
    this.privateKeyHex = privateKeyHex;
    return this;
  }

  withAddress(address: string) {
    this.address = address;
    return this;
  }

  withCustomMessage(customMessage: object) {
    this.customMessage = customMessage;
    return this;
  }

  async build(): Promise<FilecoinTx> {
    const privKey = Uint8Array.from(Buffer.from(this.privateKeyHex, 'hex'));
    const pubKeyUncompressed = getPublicKey(privKey, false);
    const address =
      this.address || AddressSecp256k1.fromPublicKey(pubKeyUncompressed, 'mainnet').toString();

    const message = {
      Version: 0,
      To: address,
      From: address,
      Nonce: 0,
      Value: '0',
      GasFeeCap: '0',
      GasPremium: '0',
      GasLimit: 1000000,
      Method: 0,
      Params: this.encodeChallengeBase64(),
      ...this.customMessage,
    };

    const serialized = transactionSerialize(message);
    const serializedBytes = hexToBytes(serialized);
    const CID_PREFIX = Uint8Array.from([0x01, 0x71, 0xa0, 0xe4, 0x02, 0x20]);
    const digestInner = blake2b(serializedBytes, { dkLen: 32 });
    const digestMiddle = Uint8Array.from(Buffer.concat([CID_PREFIX, digestInner]));
    const digest = blake2b(digestMiddle, { dkLen: 32 });

    const sig = await signAsync(digest, privKey);
    const compact = sig.toCompactRawBytes();
    const recovery = sig.recovery;
    const sig65 = Uint8Array.from([...compact, recovery]);
    const signatureData = Buffer.from(sig65).toString('base64');

    const transaction = JSON.stringify({ Message: message, Signature: { Data: signatureData } });
    const pubKeyBase64 = Buffer.from(pubKeyUncompressed).toString('base64');

    return { address, pubKeyBase64, transaction };
  }

  private encodeChallengeBase64() {
    const cborBytes = cbor.encode(this.challenge);
    return Buffer.from(cborBytes).toString('base64');
  }
}
