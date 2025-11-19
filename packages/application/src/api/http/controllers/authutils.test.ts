import { describe, expect, it } from 'vitest';
import { getPublicKey, etc } from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import cbor from 'cbor';
import { verifyLedgerPoP } from './authutils';
import { FilecoinTxBuilder } from '@src/testing/mocks/builders';

// Ensure noble-secp256k1 HMAC is set in case setup didn't run yet
if (!etc.hmacSha256Sync) {
  etc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) =>
    hmac(sha256, key, etc.concatBytes(...msgs));
}

describe('verifyLedgerPoP (integration)', () => {
  it('returns true for a valid signed transaction and matching challenge', async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withChallenge(challenge)
      .build();

    const ok = await verifyLedgerPoP(address, pubKeyBase64, transaction, challenge);
    expect(ok).toBe(true);
  });

  it("throws when To/From/Nonce don't match expected (replay guard)", async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withChallenge(challenge)
      .build();

    const parsed = JSON.parse(transaction);
    parsed.Message.From = 'f1different';

    await expect(
      verifyLedgerPoP(address, pubKeyBase64, JSON.stringify(parsed), challenge),
    ).rejects.toThrow("addresses don't match");
  });

  it('throws when derived address from pubkey does not match provided address', async () => {
    const challenge = 'challenge';
    const { address, transaction } = await new FilecoinTxBuilder().withChallenge(challenge).build();

    const otherPriv = Uint8Array.from(
      Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
    );
    const otherPub = getPublicKey(otherPriv, false);
    const otherPubB64 = Buffer.from(otherPub).toString('base64');

    await expect(verifyLedgerPoP(address, otherPubB64, transaction, challenge)).rejects.toThrow(
      'wrong key for address',
    );
  });

  it("throws when pre-image doesn't match", async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withChallenge(challenge)
      .build();
    await expect(
      verifyLedgerPoP(address, pubKeyBase64, transaction, 'different-challenge'),
    ).rejects.toThrow("pre-images don't match");
  });

  it("throws when signature doesn't exist", async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withChallenge(challenge)
      .build();
    const parsed = JSON.parse(transaction);
    parsed.Signature.Data = '';

    await expect(
      verifyLedgerPoP(address, pubKeyBase64, JSON.stringify(parsed), challenge),
    ).rejects.toThrow("signature doesn't exist");
  });

  it('throws when signature has wrong length', async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withChallenge(challenge)
      .build();
    const parsed = JSON.parse(transaction);
    const sigBytes = Buffer.from(parsed.Signature.Data, 'base64');
    const wrongLen = sigBytes.subarray(0, 64);
    parsed.Signature.Data = Buffer.from(wrongLen).toString('base64');

    await expect(
      verifyLedgerPoP(address, pubKeyBase64, JSON.stringify(parsed), challenge),
    ).rejects.toThrow('Bad signature length: 64');
  });

  it('should throw "addresses don\'t match" when nonce is not 0', async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withCustomMessage({ Nonce: 1 })
      .withChallenge(challenge)
      .build();

    await expect(verifyLedgerPoP(address, pubKeyBase64, transaction, challenge)).rejects.toThrow(
      "addresses don't match",
    );
  });

  it('should throw "addresses don\'t match" when address does not match', async () => {
    const challenge = 'challenge';
    const { address, pubKeyBase64, transaction } = await new FilecoinTxBuilder()
      .withChallenge(challenge)
      .build();

    const parsed = JSON.parse(transaction);
    parsed.Message.To = 'f1evc3p45ke4apzvi5ix25mniemuva6umggusmdif';

    await expect(
      verifyLedgerPoP(address, pubKeyBase64, JSON.stringify(parsed), challenge),
    ).rejects.toThrow("addresses don't match");
  });
});
