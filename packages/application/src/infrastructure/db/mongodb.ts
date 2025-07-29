import { MongoClientOptions, MongoClient, Db } from 'mongodb';

export const createMongodbConnection = async (
  host: string,
  dbName: string,
  options?: MongoClientOptions,
): Promise<Db> => {
  const client = new MongoClient(host, {
    ...options,
  });
  return client
    .connect()
    .then(() => client.db(dbName))
    .catch(error => {
      console.error('Failed to connect to MongoDB:', error);
      throw error; // Rethrow the error to be handled by the caller
    });
};
