import { inject, injectable } from 'inversify';
import { Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import { FilfoxClientConfig } from '../interfaces';

export interface FilfoxMessages {
  messages: Message[];
  methods: string[];
  totalCount: number;
}

export interface Subcall {
  from: string;
  fromId: string;
  fromActor: string;
  to: string;
  toId: string;
  toActor: string;
  value: string;
  method: string;
  methodNumber: number;
  params: string;
  receipt: {
    exitCode: number;
    return: string;
  };
  decodedParams: {
    Method: number;
    Value: string;
    Params: string;
    To: string;
  };
  decodedReturnValue: {
    TxId: number;
    Applied: boolean;
    ExitCode: number;
    Ret: string;
  };
  subcalls: Subcall[];
}

export interface Message {
  cid: string;
  height: number;
  timestamp: number;
  from: string;
  to: string;
  nonce: number;
  value: string;
  method: string;
  evmMethod: string;
  params: string;
  receipt: {
    exitCode: number;
    return: string;
  };
}

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

export interface IFilfoxClient {
  getFilfoxMessages(address: string, params: AxiosRequestConfig['params']): Promise<FilfoxMessages>;
  getSubcalls(cid: string): Promise<Subcall[]>;
}

@injectable()
export class FilfoxClient implements IFilfoxClient {
  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.FilfoxClientConfig)
    private readonly config: FilfoxClientConfig,
  ) {}

  async getFilfoxMessages(
    address: string,
    params: AxiosRequestConfig['params'] = {},
  ): Promise<FilfoxMessages> {
    const extendedParams = {
      pageSize: 50,
      page: 0,
      ...params,
    };

    this.logger.info(
      `Fetching Filfox messages for ${address} with params: ${JSON.stringify(extendedParams)}`,
    );
    const response = await axios.get<FilfoxMessages>(
      `${this.config.apiBase}/address/${address}/messages`,
      {
        params: extendedParams,
      },
    );

    return response?.data ?? {};
  }

  async getSubcalls(cid: string): Promise<Subcall[]> {
    this.logger.info(`Fetching Filfox subcalls for ${cid}`);
    const response = await axios.get(`${this.config.apiBase}/message/${cid}/subcalls`);
    return response?.data ?? [];
  }
}
