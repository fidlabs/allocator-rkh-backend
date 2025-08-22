export interface RkhConfig {
  rkhAddress: string;
  rkhThreshold: number;
}

export interface RpcProviderConfig {
  evmRpcUrl: string;
  useTestNet: boolean;
  testNetConfig?: {
    url: string;
    chainId: number;
    networkName: string;
  };
}

export interface LotusClientConfig {
  rpcUrl: string;
  authToken: string;
}
