import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { ethers } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { RpcProviderConfig } from '../interfaces';

export interface IRpcProvider {
  getBlockNumber(): Promise<number>;

  getBlock(blockNumber: number): Promise<ethers.providers.Block>;

  getLogs(filter: ethers.providers.Filter): Promise<ethers.providers.Log[]>;

  send<T>(method: string, params?: Array<unknown>): Promise<T>;
}

@injectable()
export class RpcProvider implements IRpcProvider {
  private rpcProvider: JsonRpcProvider;

  constructor(
    @inject(TYPES.RpcProviderConfig)
    config: RpcProviderConfig,
  ) {
    this.rpcProvider =
      config.useTestNet && !!config.testNetConfig
        ? new ethers.providers.JsonRpcProvider(config.testNetConfig?.url, {
            chainId: config.testNetConfig.chainId,
            name: config.testNetConfig.networkName,
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

  async getBlock(blockNumber: number): Promise<ethers.providers.Block> {
    return await this.rpcProvider.getBlock(blockNumber);
  }
}
