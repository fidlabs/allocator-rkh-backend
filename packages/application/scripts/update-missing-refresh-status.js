// Migration script: sets 'refreshStatus: "PENDING"' in IssueDetails for documents missing this field in
// the 'issueDetails' collection.
// Usage example:
// MONGODB_URI='mongodb://localhost:27017' DB_NAME='filecoin-plus' node scripts/update-missing-refresh-status.js

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const envs = {
  MONGODB_URI: process.env.MONGODB_URI,
  DB_NAME: process.env.DB_NAME,
};

const missingVars = Object.entries(envs)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing environment variables:', missingVars.join(', '));
  process.exit(1);
}

const client = new MongoClient(envs.MONGODB_URI);

try {
  await client.connect();
  const db = client.db(envs.DB_NAME);
  const result = await db
    .collection('issueDetails')
    .updateMany({ refreshStatus: { $exists: false } }, { $set: { refreshStatus: 'PENDING' } });
  console.log(
    `Updated ${result.modifiedCount} documents in the 'applications' collection by setting refreshStatus to 'PENDING'.`,
  );
} catch (err) {
  console.error('Migration error:', err);
  process.exit(2);
} finally {
  await client.close();
}
