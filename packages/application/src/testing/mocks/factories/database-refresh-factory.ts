import { faker } from '@faker-js/faker';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';

export class DatabaseRefreshFactory {
  static create(overrides: Partial<IssueDetails> = {}): IssueDetails {
    return {
      githubIssueId: faker.number.int(),
      title: `[DataCap Refresh] - ${faker.company.name()}`,
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
      ...overrides,
    };
  }
}
