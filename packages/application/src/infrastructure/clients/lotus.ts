import { Logger } from '@filecoin-plus/core';
import axios from 'axios';
import { inject, injectable } from 'inversify';
import { nanoid } from 'nanoid';

import { Cid, TYPES } from '@src/types';

export type PendingTx = {
  id: number;
  to: string;
  method: number;
  params: string;
  value: string;
  approved: string[];
};

export type ApprovedTx = {
  cid: string;
  to: string;
  from: string;
  timestamp: number;
  params: string;
};

type Multisig = {
  address: string;
  threshold: number;
  signers: string[];
  pendingTxs: PendingTx[];
  approvedTxs: ApprovedTx[];
};

export interface ILotusClient {
  getActorId(address: string): Promise<string>;

  getMultisig(id: string): Promise<Multisig>;

  getChainHead(): Promise<any>;

  getActor(address: string, headCids: Cid[]): Promise<any>;

  getChainObj(address: Cid): Promise<Buffer>;
}

export interface LotusClientConfig {
  rpcUrl: string;
  authToken: string;
}

@injectable()
export class LotusClient implements ILotusClient {
  private cacheAddress = {};

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.LotusClientConfig)
    private readonly config: LotusClientConfig,
  ) {}

  async getActorId(address: string): Promise<string> {
    return await this.cachedActorAddress(address);
  }

  async cachedActorAddress(str: string) {
    if (this.cacheAddress[str]) {
      return this.cacheAddress[str];
    }
    try {
      const headCids = (await this.getChainHead()).Cids;
      const ret = await this.request('Filecoin.StateLookupID', [str, headCids]);
      this.cacheAddress[str] = ret;
      return ret;
    } catch (err) {
      return str;
    }
  }

  async getMultisig(id: string): Promise<Multisig> {
    this.logger.debug(`Fetching multisig: ${id}`);
    const multisigState = await this.request('Filecoin.StateReadState', [id, null]);

    const signersIds = multisigState.State.Signers;
    const signers = await Promise.all(
      signersIds.map(async (signerId: string) => {
        return await this.request('Filecoin.StateReadState', [signerId, null]);
      }),
    );

    const pendingTxs = await this.request('Filecoin.MsigGetPending', [id, null]);
    this.logger.debug(`Found ${pendingTxs.length} pending transactions for multisig ${id}`);
    console.log('pendingTxs', pendingTxs);

    // NOTE: to get the approved transactions we should be able to use Filecoin.StateListMessages
    // method and filter it but our Lotus node provider doesn't support it, so use Filfox instead.
    //
    //const approvedTxs = await this.request('Filecoin.StateListMessages', [{"To": id}, [], null])

    // TODO should cache the most recent time we checked rather than always fetching the last 50
    const filfoxResult = await axios.get(
      `https://filfox.info/api/v1/address/${id}/messages?pageSize=50&page=0`,
    );
    this.logger.debug(
      `Found ${filfoxResult?.data?.messages?.length} recent transactions for multisig ${id}`,
    );
    console.log('recentTxs', filfoxResult?.data?.messages);

    let recentApprovedTxs = [] as any[];

    // Expect Filfox to not always be available, so quietly ignore errors on this go-around
    if (filfoxResult?.data?.messages) {
      for (const tx of filfoxResult.data.messages) {
        if (tx.to === id && tx.method === 'Approve') {
          this.logger.debug(`Found approved transaction: ${JSON.stringify(tx)}`);
          recentApprovedTxs.push(tx);
        }
      }
    }

    const multisig = {
      address: id,
      threshold: multisigState.State.NumApprovalsThreshold,
      signers: signers.map(signers => signers.State.Address),
      pendingTxs: pendingTxs.map((tx: any) => ({
        id: tx.ID,
        to: tx.To,
        method: tx.Method,
        params: tx.Params,
        value: tx.Value,
        approved: tx.Approved,
      })),
      approvedTxs: recentApprovedTxs.map((tx: any) => ({
        cid: tx.cid,
        to: tx.to,
        from: tx.from,
        timestamp: tx.timestamp,
        params: tx.params,
      })),
    };
    this.logger.debug(`Returning Multisig state for ${id}: ${JSON.stringify(multisig)}`);

    return multisig;
  }

  async getChainHead(): Promise<any> {
    return await this.request('Filecoin.ChainHead', []);
  }

  async getActor(address: string, headCids: Cid[]): Promise<any> {
    return await this.request('Filecoin.StateGetActor', [address, []]);
  }

  async getChainObj(address: Cid): Promise<Buffer> {
    const resp = await this.request('Filecoin.ChainReadObj', [address]);
    const bin = Buffer.from(resp, 'base64');
    return bin;
  }

  private async request(method: string, params: any[]) {
    const requestId = nanoid();
    const requestBody = JSON.stringify({
      method,
      params,
      id: requestId,
      jsonrpc: '2.0',
    });

    this.logger.debug(`Executing Lotus RPC request: ${method} ${requestBody}`);
    const response = await axios.post(this.config.rpcUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
        'content-type': 'application/json',
      },
    });

    const responseData = response.data;
    if (responseData.error) {
      this.logger.error(`Lotus RPC request failed: ${requestId} ${responseData.error.message}`);
      throw new Error(responseData.error.message);
    }
    if (responseData.result === undefined) {
      this.logger.error(`Lotus RPC request failed: ${requestId} Missing result`);
      throw new Error('Missing result');
    }

    this.logger.debug(
      `Lotus RPC request successful: ${requestId} ${JSON.stringify(responseData.result)}`,
    );
    return responseData.result;
  }
}
