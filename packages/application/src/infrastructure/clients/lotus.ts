import { Logger } from "@filecoin-plus/core";
import { VerifyAPI } from "@keyko-io/filecoin-verifier-tools";
import axios from "axios";
import { inject, injectable } from "inversify";
import { nanoid } from "nanoid";

import { TYPES } from "@src/types";

type PendingTx = {
  id: number;
  to: string;
  method: number;
  params: string;
  value: string;
  approved: string[];
};

type Multisig = {
  address: string;
  threshold: number;
  signers: string[];
  pendingTxs: PendingTx[];
};

export interface ILotusClient {
  getMultisig(id: string): Promise<Multisig>;
  getActorId(address: string): Promise<string>;
  getDatacapAllocations(): Promise<{ allocatorId: string; datacap: number }[]>;
}

export interface LotusClientConfig {
  rpcUrl: string;
  authToken: string;
}

@injectable()
export class LotusClient implements ILotusClient {
  private readonly api: VerifyAPI;

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.LotusClientConfig)
    private readonly config: LotusClientConfig
  ) {
    this.api = new VerifyAPI(
      VerifyAPI.standAloneProvider(config.rpcUrl, {
        token: async () => {
          return config.authToken;
        },
      }),
      {},
      false // if node != Mainnet => testnet = true
    );
  }

  async getActorId(address: string): Promise<string> {
    return await this.api.cachedActorAddress(address);
  }

  async getDatacapAllocations(): Promise<
    { allocatorId: string; datacap: number }[]
  > {
    const verifiers = await this.api.listVerifiers();
    return verifiers.map((verifier) => ({
      allocatorId: verifier.verifier as string,
      datacap: verifier.datacap as number,
    }));
  }

  async getMultisig(id: string): Promise<Multisig> {
    this.logger.debug(`Fetching multisig: ${id}`);
    const multisigState = await this.request("Filecoin.StateReadState", [
      id,
      null,
    ]);

    const signersIds = multisigState.State.Signers;
    const signers = await Promise.all(
      signersIds.map(async (signerId: string) => {
        return await this.request("Filecoin.StateReadState", [signerId, null]);
      })
    );

    const pendingTxs = await this.request("Filecoin.MsigGetPending", [
      id,
      null,
    ]);

    const multisig = {
      address: id,
      threshold: multisigState.State.NumApprovalsThreshold,
      signers: signers.map((signer) => signer.State.Address),
      pendingTxs: pendingTxs.map((tx: any) => ({
        id: tx.ID,
        to: tx.To,
        method: tx.Method,
        params: tx.Params,
        value: tx.Value,
        approved: tx.Approved,
      })),
    };
    this.logger.debug(`Multisig ${id}: ${JSON.stringify(multisig)}`);

    return multisig;
  }

  private async request(method: string, params: any[]) {
    const requestId = nanoid();
    const requestBody = JSON.stringify({
      method,
      params,
      id: requestId,
      jsonrpc: "2.0",
    });

    this.logger.debug(`Executing Lotus RPC request: ${method} ${requestBody}`);
    const response = await axios.post(this.config.rpcUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
        "content-type": "application/json",
      },
    });

    const responseData = response.data;
    if (responseData.error) {
      this.logger.error(
        `Lotus RPC request failed: ${requestId} ${responseData.error.message}`
      );
      throw new Error(responseData.error.message);
    }
    if (responseData.result === undefined) {
      this.logger.error(
        `Lotus RPC request failed: ${requestId} Missing result`
      );
      throw new Error("Missing result");
    }

    this.logger.debug(
      `Lotus RPC request successful: ${requestId} ${JSON.stringify(
        responseData.result
      )}`
    );
    return responseData.result;
  }
}
