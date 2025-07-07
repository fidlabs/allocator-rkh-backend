import { faker } from '@faker-js/faker';
import { IssuesWebhookPayload } from '@src/infrastructure/clients/github';

export class GithubIssueFactory {
  static createOpened(overrides: Partial<IssuesWebhookPayload> = {}): IssuesWebhookPayload {
    const userId = faker.number.int({ min: 10000000, max: 999999999 });
    const issueId = faker.number.int({ min: 100000000, max: 999999999 });
    const issueNumber = faker.number.int({ min: 1000, max: 9999 });
    const repoId = faker.number.int({ min: 10000000, max: 999999999 });
    const userLogin = faker.internet.username();
    const recHash = `rec${faker.string.alphanumeric(15)}`;
    const createdDate = faker.date.past({ years: 1 });
    const updatedDate = faker.date.between({ from: createdDate, to: new Date() });

    return {
      action: 'opened',
      issue: {
        id: issueId,
        node_id: `I_kwDO${faker.string.alphanumeric(12)}`,
        number: issueNumber,
        title: `[DataCap Refresh] - ${faker.company.name()}`,
        user: {
          id: userId,
          login: userLogin,
          node_id: `U_kwDO${faker.string.alphanumeric(12)}`,
          avatar_url: `https://avatars.githubusercontent.com/u/${userId}?v=4`,
          gravatar_id: '',
          url: `https://api.github.com/users/${userLogin}`,
          html_url: `https://github.com/${userLogin}`,
          type: 'User',
          site_admin: faker.datatype.boolean({ probability: 0.1 }),
        },
        labels: faker.helpers.arrayElements(
          [
            {
              id: faker.number.int({ min: 100000000, max: 999999999 }),
              node_id: `LA_kwDO${faker.string.alphanumeric(12)}`,
              url: `https://api.github.com/repos/filecoin-project/filecoin-plus-large-datasets/labels/${encodeURIComponent('state:submitted')}`,
              name: faker.helpers.arrayElement([
                'state:submitted',
                'state:review',
                'state:approved',
                'priority:high',
                'priority:medium',
                'type:audit',
              ]),
              color: faker.color.rgb().slice(1),
              default: false,
              description: faker.lorem.sentence(),
            },
          ],
          { min: 1, max: 3 },
        ),
        state: 'open',
        locked: faker.datatype.boolean({ probability: 0.05 }),
        assignees: faker.helpers.arrayElements(
          [
            {
              id: faker.number.int({ min: 10000000, max: 999999999 }),
              login: faker.internet.username(),
              node_id: `U_kwDO${faker.string.alphanumeric(12)}`,
              avatar_url: `https://avatars.githubusercontent.com/u/${faker.number.int({
                min: 10000000,
                max: 999999999,
              })}?v=4`,
              gravatar_id: '',
              url: `https://api.github.com/users/${faker.internet.username()}`,
              html_url: `https://github.com/${faker.internet.username()}`,
              type: 'User',
              site_admin: false,
            },
          ],
          { min: 0, max: 3 },
        ),
        comments: faker.number.int({ min: 0, max: 25 }),
        created_at: createdDate.toISOString(),
        updated_at: updatedDate.toISOString(),
        closed_at: null,
        author_association: faker.helpers.arrayElement([
          'CONTRIBUTOR',
          'COLLABORATOR',
          'MEMBER',
          'OWNER',
          'NONE',
        ]),
        active_lock_reason: null,
        draft: false,
        body: this.generateBody(recHash),
        reactions: {
          url: `https://api.github.com/repos/filecoin-project/filecoin-plus-large-datasets/issues/${issueNumber}/reactions`,
          total_count: faker.number.int({ min: 0, max: 15 }),
          '+1': faker.number.int({ min: 0, max: 8 }),
          '-1': faker.number.int({ min: 0, max: 2 }),
          laugh: faker.number.int({ min: 0, max: 3 }),
          hooray: faker.number.int({ min: 0, max: 5 }),
          confused: faker.number.int({ min: 0, max: 2 }),
          heart: faker.number.int({ min: 0, max: 4 }),
          rocket: faker.number.int({ min: 0, max: 3 }),
          eyes: faker.number.int({ min: 0, max: 6 }),
        },
        timeline_url: `https://api.github.com/repos/filecoin-project/filecoin-plus-large-datasets/issues/${issueNumber}/timeline`,
        performed_via_github_app: null,
        state_reason: faker.helpers.arrayElement([null, 'completed', 'not_planned']),
      } as IssuesWebhookPayload['issue'],
      repository: {
        id: repoId,
        node_id: `R_kwDO${faker.string.alphanumeric(12)}`,
        name: 'filecoin-plus-large-datasets',
        full_name: 'filecoin-project/filecoin-plus-large-datasets',
        owner: {
          id: 19580481,
          login: 'filecoin-project',
          node_id: 'MDEyOk9yZ2FuaXphdGlvbjE5NTgwNDgx',
          avatar_url: 'https://avatars.githubusercontent.com/u/19580481?v=4',
          gravatar_id: '',
          url: 'https://api.github.com/users/filecoin-project',
          html_url: 'https://github.com/filecoin-project',
          type: 'Organization',
          site_admin: false,
        },
        private: false,
        html_url: 'https://github.com/filecoin-project/filecoin-plus-large-datasets',
        description: 'Filecoin Plus Large Dataset applications',
        fork: false,
        url: 'https://api.github.com/repos/filecoin-project/filecoin-plus-large-datasets',
        created_at: faker.date.past({ years: 2 }).toISOString(),
        updated_at: faker.date.recent().toISOString(),
        pushed_at: faker.date.recent().toISOString(),
        clone_url: 'https://github.com/filecoin-project/filecoin-plus-large-datasets.git',
        size: faker.number.int({ min: 50000, max: 200000 }),
        stargazers_count: faker.number.int({ min: 50, max: 500 }),
        watchers_count: faker.number.int({ min: 50, max: 500 }),
        language: faker.helpers.arrayElement(['JavaScript', 'TypeScript', 'Python', null]),
        forks_count: faker.number.int({ min: 20, max: 150 }),
        archived: false,
        disabled: false,
        open_issues_count: faker.number.int({ min: 50, max: 400 }),
        license: {
          key: 'mit',
          name: 'MIT License',
          spdx_id: 'MIT',
          url: 'https://api.github.com/licenses/mit',
          node_id: 'MDc6TGljZW5zZW1pdA==',
        },
        allow_forking: true,
        is_template: false,
        topics: ['filecoin', 'dataset', 'datacap'],
        visibility: 'public',
        forks: faker.number.int({ min: 20, max: 150 }),
        open_issues: faker.number.int({ min: 50, max: 400 }),
        watchers: faker.number.int({ min: 50, max: 500 }),
        default_branch: 'main',
      } as IssuesWebhookPayload['repository'],
      sender: {
        id: userId,
        login: userLogin,
        node_id: `U_kwDO${faker.string.alphanumeric(12)}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${userId}?v=4`,
        gravatar_id: '',
        url: `https://api.github.com/users/${userLogin}`,
        html_url: `https://github.com/${userLogin}`,
        type: 'User',
        site_admin: faker.datatype.boolean({ probability: 0.1 }),
      } as IssuesWebhookPayload['sender'],
      ...overrides,
    };
  }

  static createEdited(overrides: Partial<IssuesWebhookPayload> = {}): IssuesWebhookPayload {
    const baseIssue = this.createOpened();
    const originalCreatedDate = new Date(baseIssue.issue.created_at);
    const recentUpdatedDate = faker.date.between({
      from: originalCreatedDate,
      to: new Date(),
    });

    return {
      ...baseIssue,
      action: 'edited',
      issue: {
        ...baseIssue.issue,
        updated_at: recentUpdatedDate.toISOString(),
        title: `[DataCap Refresh] ${faker.helpers.arrayElement(['Allocator Review', 'Compliance Report', 'Audit Review'])} - ${faker.company.name()}`,
      },
      ...overrides,
    };
  }

  private static generateBody(recHash: string): string {
    return [
      this.generateAuditTypeSection(),
      this.generateJsonHashSection(recHash),
      this.generateAllocatorDescriptionSection(),
      this.generateComplianceReportSection(),
      this.generatePreviousReviewsSection(),
      this.generateClientAllocationTableSection(),
      this.generateClientBreakdownSection(),
      this.generateNotesSection(),
      this.generateIssuesSection(),
      this.generateStepsSection(),
      this.generateValueSection(),
      this.generateConfirmationSection(),
      this.generateUnderstandingSection(),
    ].join('\n\n');
  }

  private static generateAuditTypeSection(): string {
    return `### What type of Audit did you opt into? Choose from dropdown\n\n${faker.helpers.arrayElement(['Enterprise Data', 'Public Data', 'Research Data', 'Commercial Data'])}`;
  }

  private static generateJsonHashSection(recHash: string): string {
    return `### What is your JSON hash (starts with 'rec')\n\n${recHash}`;
  }

  private static generateAllocatorDescriptionSection(): string {
    return `### Link to your allocator operations description\n\n${faker.internet.url()}`;
  }

  private static generateComplianceReportSection(): string {
    return `### Compliance Report\n\n${faker.internet.url()}`;
  }

  private static generatePreviousReviewsSection(): string {
    return `### Previous Reviews\n\n- [1st review] ${faker.internet.url()} Outcome: ${faker.helpers.arrayElement(['5', '10', '25', '50', '100'])} PiB\n- [2nd review] ${faker.internet.url()} Outcome: ${faker.helpers.arrayElement(['10', '25', '50', '100', '200'])} PiB\n_(Add more review blocks as needed)_`;
  }

  private static generateClientAllocationTableSection(): string {
    const clientCount = faker.number.int({ min: 2, max: 5 });
    const clients = Array.from({ length: clientCount }, (_, index) => ({
      name: `Client ${index + 1}`,
      dcGranted: faker.helpers.arrayElement(['0 PiB', '5 PiB', '10 PiB', '25 PiB', '50 PiB']),
    }));

    const clientTable = clients
      .map(client => `| ${client.name}    | ${client.dcGranted}      |`)
      .join('\n');

    return `### Client Allocation Table\n\n| Client name | DC granted |\n| ----------- | ---------- |\n${clientTable}`;
  }

  private static generateClientBreakdownSection(): string {
    const clientCount = faker.number.int({ min: 2, max: 5 });
    const clients = Array.from({ length: clientCount }, (_, index) => ({
      name: `Client ${index + 1}`,
      dcGranted: faker.helpers.arrayElement(['0 PiB', '5 PiB', '10 PiB', '25 PiB', '50 PiB']),
      dcRequested: faker.helpers.arrayElement(['10 PiB', '25 PiB', '50 PiB', '100 PiB', '200 PiB']),
      spId: `f0${faker.number.int({ min: 1000, max: 9999 })}`,
      retrievalRate: faker.number.int({ min: 75, max: 99 }),
    }));

    const clientBreakdowns = clients
      .map(
        client =>
          `#### ${client.name}\n\nI. [${client.name}](${faker.internet.url()})  \n- DC requested: ${client.dcRequested}  \n- DC granted so far: ${client.dcGranted}  \n\nII. **Dataset Completion**  \n${faker.lorem.sentence()}\n\nIII. **SP Match**  \n${faker.helpers.arrayElement(['Yes, all SPs match', 'Minor discrepancies found', 'Mostly matching with 1-2 exceptions'])}\n\nIV. **Replica Count**  \nPromised vs delivered: ${faker.number.int(
            {
              min: 3,
              max: 10,
            },
          )}/${faker.number.int({
            min: 3,
            max: 10,
          })}  \n\nV. **SP Retrieval Performance**  \n| SP ID  | % retrieval | Meets >75%? |\n|--------|-------------|--------------|  \n| ${client.spId} | ${client.retrievalRate}%         | ${client.retrievalRate >= 75 ? 'YES' : 'NO'}          |\n\n---`,
      )
      .join('\n\n');

    return `### Client-specific Breakdown\n\n${clientBreakdowns}\n\n_(Add more client blocks as needed)_`;
  }

  private static generateNotesSection(): string {
    return `### Notes from the Allocator\n\n${faker.lorem.paragraph()}`;
  }

  private static generateIssuesSection(): string {
    return `### Issues or discrepancies reported?\n\n${faker.lorem.sentence()}`;
  }

  private static generateStepsSection(): string {
    return `### Steps to minimize unfair or risky practices\n\n${faker.lorem.paragraph()}`;
  }

  private static generateValueSection(): string {
    return `### Value to the Filecoin ecosystem\n\n${faker.lorem.paragraph()}`;
  }

  private static generateConfirmationSection(): string {
    return `### Confirm you maintained your application standards for all client allocations\n\n${faker.helpers.arrayElement(['Yes', 'No', 'Partially'])}`;
  }

  private static generateUnderstandingSection(): string {
    return `### Do you understand that a diligence review will follow and require updates to this issue?\n\n${faker.helpers.arrayElement(['Yes', 'No'])}`;
  }
}
