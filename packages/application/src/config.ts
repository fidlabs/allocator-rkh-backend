import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_POLLING_INTERVAL = 60 * 5 * 1000; // 5 minutes in ms

export default {
  API_PORT: process.env.API_PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  DB_NAME: process.env.DB_NAME || 'filecoin-plus',

  // Logging configuration
  LOG_LEVEL: (process.env.LOG_LEVEL as 'info' | 'debug') || 'info',

  // RabbitMQ configuration
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'localhost:5672',
  RABBITMQ_USERNAME: process.env.RABBITMQ_USERNAME || 'guest',
  RABBITMQ_PASSWORD: process.env.RABBITMQ_PASSWORD || 'guest',
  RABBITMQ_EXCHANGE_NAME: process.env.RABBITMQ_EXCHANGE_NAME || 'filecoin-plus',
  RABBITMQ_EXCHANGE_TYPE: process.env.RABBITMQ_EXCHANGE_TYPE || 'topic',
  RABBITMQ_QUEUE_NAME: process.env.RABBITMQ_QUEUE_NAME || 'filecoin-plus',

  // GitHub client configuration
  GITHUB_OWNER: process.env.GITHUB_OWNER || 'threesigmaxyz',
  GITHUB_REPO: process.env.GITHUB_REPO || 'Allocator-Registry',
  GITHUB_ISSUES_REPO: process.env.GITHUB_ISSUES_REPO || 'Allocator-Governance',
  GITHUB_ISSUES_OWNER: process.env.GITHUB_ISSUES_OWNER || 'filecoin-project',
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '1',
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\n...',
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID || '1337',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,

  // Airtable client configuration
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || 'your-airtable-api-key',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || 'app99ksFs7kqCrBZ2',
  AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME || 'tblAGAD0kgWxy5kwq',

  // Lotus client configuration
  LOTUS_RPC_URL: process.env.LOTUS_RPC_URL || 'https://filecoin.chain.love/',
  LOTUS_AUTH_TOKEN: process.env.LOTUS_AUTH_TOKEN || 'your-lotus-auth-token',

  // GitHub handles & wallets for the governance team
  GOVERNANCE_TEAM_GITHUB_HANDLES: process.env.GOVERNANCE_TEAM_GITHUB_HANDLES
    ? process.env.GOVERNANCE_TEAM_GITHUB_HANDLES.split(',').map(handle => handle.trim())
    : ['galen-mcandrew', 'Kevin-FF-USA'],
  GOVERNANCE_REVIEW_ADDRESSES: process.env.GOVERNANCE_REVIEW_ADDRESSES
    ? process.env.GOVERNANCE_REVIEW_ADDRESSES.split(',').map(handle => handle.trim())
    : [],
  //allowed RKH addresses
  RKH_ADDRESSES: process.env.RKH_ADDRESSES
    ? process.env.RKH_ADDRESSES.split(',').map(handle => handle.trim())
    : [],
  //MDMA addresses
  MA_ADDRESSES: process.env.MA_ADDRESSES
    ? process.env.MA_ADDRESSES.split(',').map(handle => handle.trim())
    : ['0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d'],

  // Admin API key configuration
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'default_admin_api_key',

  // Secrets for KYC and reviews
  KYC_ENDPOINT_SECRET: process.env.KYC_ENDPOINT_SECRET || '',
  GOVERNANCE_REVIEW_SECRET: process.env.GOVERNANCE_REVIEW_SECRET || '',

  // Refresh application threshold
  REFRESH_MIN_THRESHOLD_PCT: Number(process.env.REFRESH_MIN_THRESHOLD_PCT) || 25,

  // Pooling intervals
  SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL) ||
    DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_APPLICATION_EDITS_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_APPLICATION_EDITS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_GOVERNANCE_REVIEWS_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_GOVERNANCE_REVIEWS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_DATACAP_ALLOCATIONS_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_DATACAP_ALLOCATIONS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_REFRESH_RKH_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_REFRESH_RKH_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_REFRESH_META_ALLOCATOR_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_REFRESH_META_ALLOCATOR_POLLING_INTERVAL) ||
    DEFAULT_POLLING_INTERVAL,

  SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL:
    Number(process.env.SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL) ||
    DEFAULT_POLLING_INTERVAL,
  VALID_META_ALLOCATOR_ADDRESSES: process.env.VALID_META_ALLOCATOR_ADDRESSES
    ? process.env.VALID_META_ALLOCATOR_ADDRESSES.split(',').map(address =>
        address.trim().toLowerCase(),
      )
    : ['0xb6f5d279aead97dfa45209f3e53969c2ef43c21d'],

  EVM_RPC_URL: process.env.EVM_RPC_URL || 'http://84.70.152.51:1234/rpc/v1',

  // local test net config
  USE_TEST_NET: Boolean(process.env.USE_TEST_NET) || false,
  TEST_NET_CHAIN_ID: Number(process.env.EST_NET_CHAIN_ID) || 31415926,
  TEST_NET_URL: process.env.TEST_NET_URL || 'http://84.70.152.51:1234/rpc/v1',
  TEST_NET_NETWORK_NAME: process.env.TEST_NET_NETWORK_NAME || 'local-test-net',

  META_ALLOCATOR_CONTRACT_ADDRESS:
    process.env.META_ALLOCATOR_CONTRACT_ADDRESS || '0x15A9D9b81E3c67b95Ffedfb4416D25a113C8c6df',
  VERIFIED_REGISTRY_ACTOR_ADDRESS: process.env.VERIFIED_REGISTRY_ACTOR_ADDRESS || 'f06',

  RKH_ADDRESS: process.env.RKH_ADDRESS || 'f080',
  RKH_THRESHOLD: Number(process.env.RKH_THRESHOLD) || 2,
};
