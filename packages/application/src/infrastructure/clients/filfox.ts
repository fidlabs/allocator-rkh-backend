export async function getMultisigInfo(address: string): Promise<any> {
  const url = `https://filfox.info/api/v1/address/${address}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    console.error(`Network error fetching ${url}:`, err);
    // On network errors, propagate or choose to return undefined fields:
    return { actor: undefined, id: address, multisig: undefined, signers: undefined };
  }

  // If address is invalid, Filfox returns 404 + JSON error body.
  if (res.status === 404) {
    return {
      actor: 'invalid',
      id: address,
      multisig: undefined,
      signers: undefined,
    };
  }

  if (!res.ok) {
    // Other HTTP errors
    throw new Error(`Filfox API returned ${res.status} for ${address}`);
  }

  const payload = await res.json();

  // True multisig actor → return full payload
  if (payload.actor === 'multisig') {
    return payload;
  }

  // Account actor (f1…) → not a multisig
  if (payload.actor === 'account') {
    return {
      actor: 'account',
      id: payload.id ?? address,
      multisig: address, // echo back the f1
      signers: 'not a msig',
    };
  }
  // Any other actor types → treat as “no multisig”
  return {
    actor: payload.actor,
    id: payload.id ?? address,
    multisig: 'undefined',
    signers: 'undefined',
  };
}
