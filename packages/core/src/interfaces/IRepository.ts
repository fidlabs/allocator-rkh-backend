export interface IRepository<T> {
  save(aggregateRoot: T, expectedVersion: number): Promise<void>;
  getById(guid: string): Promise<T>;
}
