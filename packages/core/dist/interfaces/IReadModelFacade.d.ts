export interface IReadModelFacade<T> {
    getAll(): Promise<T[]>;
    getById(guid: string): Promise<T>;
}
//# sourceMappingURL=IReadModelFacade.d.ts.map