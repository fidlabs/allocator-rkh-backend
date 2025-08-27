import { transactionSerialize } from '@zondax/filecoin-signing-tools';
import { AddressSecp256k1 } from 'iso-filecoin/address';
import { Signature, verify } from '@noble/secp256k1';
import { blake2b } from '@noble/hashes/blake2';
import { hexToBytes } from '@noble/hashes/utils';
import cbor from 'cbor';

/* Verify a message with Ledger proof of possession */
export async function verifyLedgerPoP(
  address: string /* f1 of the signer */,
  pubkey: string /* base64 compact rep of public key of the signer */,
  transaction: string /* Full Filecoin signed transaction, stringified */,
  challenge: string /* Challenge phrase that was (expected to be) signed */,
): Promise<boolean> {
  // Extract the dummy transaction object
  const signedFakeMessage = JSON.parse(transaction);
  const fakeMessage = signedFakeMessage.Message;
  const signature = signedFakeMessage.Signature;

  console.log('address', address);
  console.log(fakeMessage);

  // Belt-and-braces to avoid a potential replay attack
  if (fakeMessage.To !== address || fakeMessage.From !== address || fakeMessage.Nonce !== 0) {
    throw new Error("addresses don't match");
  }

  // More belt-and-brace to make sure the signing key actually
  // belongs to the claimed account (avoids trivial RBAC avoidance)
  const pubKeyBytes = Uint8Array.from(Buffer.from(pubkey, 'base64'));
  const newDerivedAddress = AddressSecp256k1.fromPublicKey(pubKeyBytes, 'mainnet');
  const challengeAddress = newDerivedAddress.toString();
  if (challengeAddress !== address) {
    throw new Error('wrong key for address');
  }

  // Reconstruct the pre-image to avoid substitution attacks
  const expectedPreImageCBOR = cbor.encode(challenge);
  const expectedPreImageBase64 = Buffer.from(expectedPreImageCBOR).toString('base64');
  if (expectedPreImageBase64 !== fakeMessage.Params) {
    console.log('expectedPreImageBase64', expectedPreImageBase64);
    console.log('fakeMessage.Params', fakeMessage.Params);
    throw new Error("pre-images don't match");
  }

  // Now the contents are OK we're ready to check the signature
  if (!signature.Data) {
    throw new Error("signature doesn't exist");
  }

  // Extract the signature in compact form - should be 64 bytes plus recovery index
  const compact_signature = Uint8Array.from(Buffer.from(signature.Data, 'base64'));
  if (compact_signature.length !== 65) {
    throw new Error(`Bad signature length: ${compact_signature.length}`);
  }
  const nobleSignature = Signature.fromCompact(compact_signature.subarray(0, 64));

  // Digest the message with CID
  const serialized = transactionSerialize(fakeMessage);
  const serializedBytes = hexToBytes(serialized);
  const CID_PREFIX = Uint8Array.from([0x01, 0x71, 0xa0, 0xe4, 0x02, 0x20]);
  const digestInner = blake2b(serializedBytes, { dkLen: 32 }); // Uint8Array(32)
  const digestMiddle = Uint8Array.from(Buffer.concat([CID_PREFIX, digestInner]));
  const digest = blake2b(digestMiddle, { dkLen: 32 }); // Uint8Array(32)

  // Now *finally* verify the signature
  const valid = verify(nobleSignature, digest, pubKeyBytes);

  if (valid) {
    return true;
  }

  return false;
}
