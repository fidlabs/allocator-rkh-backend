interface MultisigInfo {
  actor: string | undefined;
  address: string;
  id: string;
  multisig:
    | string
    | undefined
    | {
        signers: string[];
        approvalThreshold: number;
      };
  signers: string | undefined;
  robust: string | undefined;
}

export async function getMultisigInfo(address: string): Promise<MultisigInfo> {
  const url = `https://filfox.info/api/v1/address/${address}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    console.error(`Network error fetching ${url}:`, err);
    // On network errors, propagate or choose to return undefined fields:
    return {
      actor: undefined,
      id: address,
      address: address,
      multisig: undefined,
      signers: undefined,
      robust: undefined,
    };
  }

  // If address is invalid, Filfox returns 404 + JSON error body.
  if (res.status === 404) {
    return {
      actor: 'invalid',
      id: address,
      address: address,
      multisig: undefined,
      signers: undefined,
      robust: undefined,
    };
  }

  if (!res.ok) {
    // Other HTTP errors
    return {
      actor: undefined,
      id: address,
      address: address,
      multisig: undefined,
      signers: undefined,
      robust: undefined,
    };
  }

  const payload: MultisigInfo = await res.json();

  // True multisig actor → return full payload
  if (payload.actor === 'multisig') {
    return payload;
  }

  // Account actor (f1…) → not a multisig
  if (payload.actor === 'account') {
    return {
      actor: 'account',
      id: payload.id ?? address,
      address: address,
      multisig: address, // echo back the f1
      signers: 'not a msig',
      robust: undefined,
    };
  }
  // Any other actor types → treat as “no multisig”
  return {
    actor: payload.actor,
    id: payload.id ?? address,
    address: address,
    multisig: 'undefined',
    signers: 'undefined',
    robust: undefined,
  };
}
