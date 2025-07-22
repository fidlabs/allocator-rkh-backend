import { faker } from '@faker-js/faker';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';

export class DatabaseRefreshFactory {
  static create(overrides: Partial<IssueDetails> = {}): IssueDetails {
    return {
      githubIssueId: faker.number.int(),
      githubIssueNumber: faker.number.int(),
      title: `[DataCap Refresh] ${faker.company.name()}`,
      creator: {
        userId: faker.number.int(),
        name: faker.internet.username(),
      },
      assignees: faker.helpers.multiple(
        () => ({
          userId: faker.number.int(),
          name: faker.internet.username(),
        }),
        { count: 2 },
      ),
      labels: faker.helpers.multiple(() => faker.word.sample(), { count: 3 }),
      state: 'open',
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      closedAt: null,
      jsonNumber: faker.string.numeric(5),
      msigAddress: `f2${faker.string.alphanumeric(38)}`,
      metapathwayType: faker.helpers.arrayElement(['RKH', 'MDMA']),
      refreshStatus: 'PENDING',
      dataCap: faker.number.int({ min: 1, max: 50 }),
      actorId: `f0${faker.string.numeric(7)}`,
      maAddress: `f4${faker.string.alphanumeric(38)}`,
      ...overrides,
    };
  }
}
