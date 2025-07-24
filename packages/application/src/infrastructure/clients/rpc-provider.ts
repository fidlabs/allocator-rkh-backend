import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ethers } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';

export interface IRpcProvider {
  getBlockNumber(): Promise<number>;

  getLogs(filter: ethers.providers.Filter): Promise<ethers.providers.Log[]>;

  send<T>(method: string, params?: Array<unknown>): Promise<T>;
}

export interface RpcProviderConfig {
  evmRpcUrl: string;
  useTestNet: boolean;
  localTestNet?: {
    url: string;
    chainId: number;
    networkName: string;
  };
}

@injectable()
export class RpcProvider implements IRpcProvider {
  private rpcProvider: JsonRpcProvider;

  constructor(
    @inject(TYPES.RpcProviderConfig)
    config: RpcProviderConfig,
  ) {
    this.rpcProvider =
      config.useTestNet && !!config.localTestNet
        ? new ethers.providers.JsonRpcProvider(config.localTestNet?.url, {
            chainId: config.localTestNet.chainId,
            name: config.localTestNet.networkName,
          })
        : new ethers.providers.JsonRpcProvider(config.evmRpcUrl);
  }

  async getBlockNumber(): Promise<number> {
    return await this.rpcProvider.getBlockNumber();
  }

  async getLogs(filter: ethers.providers.Filter): Promise<ethers.providers.Log[]> {
    return await this.rpcProvider.getLogs(filter);
  }

  async send<T>(method: string, params: unknown[]): Promise<T> {
    return await this.rpcProvider.send(method, params);
  }
}
