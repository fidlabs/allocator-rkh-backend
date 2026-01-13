export interface RkhConfig {
  rkhAddress: string;
  rkhThreshold: number;
  indirectRKHAddresses: string[];
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

export interface GovernanceConfig {
  addresses: string[];
}

export interface MetaAllocatorConfig {
  signers: string[];
}

export interface FilfoxClientConfig {
  apiBase: string;
}
