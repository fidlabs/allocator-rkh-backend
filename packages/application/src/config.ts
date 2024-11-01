import dotenv from 'dotenv'
dotenv.config()

const DEFAULT_POLLING_INTERVAL = 10000

export default {
  API_PORT: process.env.API_PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  DB_NAME: process.env.DB_NAME || 'filecoin-plus',

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
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '1',
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\n...',
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID || '1337',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,

  // Airtable client configuration
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || 'your-airtable-api-key',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || 'app99ksFs7kqCrBZ2',
  AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME || 'tblAGAD0kgWxy5kwq',

  // Lotus client configuration
  LOTUS_RPC_URL: process.env.LOTUS_RPC_URL || 'https://api.node.glif.io/rpc/v1',
  LOTUS_AUTH_TOKEN: process.env.LOTUS_AUTH_TOKEN || 'your-lotus-auth-token',

  // GitHub handles for the governance team
  GOVERNANCE_TEAM_GITHUB_HANDLES: process.env.GOVERNANCE_TEAM_GITHUB_HANDLES
    ? process.env.GOVERNANCE_TEAM_GITHUB_HANDLES.split(',').map((handle) => handle.trim())
    : ['galen-mcandrew', 'Kevin-FF-USA'],

  // Admin API key configuration
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'default_admin_api_key',

  // Pooling intervals
  SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL: Number(process.env.SUBSCRIBE_APPLICATION_SUBMISSIONS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_APPLICATION_EDITS_POLLING_INTERVAL: Number(process.env.SUBSCRIBE_APPLICATION_EDITS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_GOVERNANCE_REVIEWS_POLLING_INTERVAL: Number(process.env.SUBSCRIBE_GOVERNANCE_REVIEWS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL: Number(process.env.SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  SUBSCRIBE_DATACAP_ALLOCATIONS_POLLING_INTERVAL: Number(process.env.SUBSCRIBE_DATACAP_ALLOCATIONS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,

  SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL: Number(process.env.SUBSCRIBE_META_ALLOCATOR_APPROVALS_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL,
  VALID_META_ALLOCATOR_ADDRESSES: process.env.VALID_META_ALLOCATOR_ADDRESSES
    ? process.env.VALID_META_ALLOCATOR_ADDRESSES.split(',').map((address) => address.trim())
    : ['0x386f08f6E8E4647B871415EBFB858b1e377d9ab2'],

  EVM_RPC_URL: process.env.EVM_RPC_URL || 'http://localhost:8545',
}
