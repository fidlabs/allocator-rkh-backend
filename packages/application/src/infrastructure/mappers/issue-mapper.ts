import { IssueDetails } from '@src/infrastructure/respositories/issue-details';
import { RepoIssue } from '@src/infrastructure/clients/github';
import { injectable } from 'inversify';
import { ILLEGAL_CHARACTERS_REGEX, JSON_NUMBER_REGEX } from './constants';

export interface IIssueMapper {
  fromDomainToIssue(githubIssue: RepoIssue): IssueDetails;

  fromDomainListToIssueList(githubIssues: RepoIssue[]): IssueDetails[];
}

@injectable()
export class IssueMapper implements IIssueMapper {
  fromDomainToIssue(githubIssue: RepoIssue): IssueDetails {
    return {
      githubIssueId: githubIssue.id,
      title: githubIssue.title,
      creator: {
        userId: githubIssue.user?.id || 0,
        name: githubIssue.user?.login || 'Unknown',
      },
      assignees:
        githubIssue.assignees?.map(assignee => ({
          userId: assignee.id,
          name: assignee.login,
        })) || [],
      labels: githubIssue.labels?.map(label => this.normalizeLabel(label)),
      createdAt: new Date(githubIssue.created_at),
      updatedAt: new Date(githubIssue.updated_at),
      closedAt: githubIssue.closed_at ? new Date(githubIssue.closed_at) : null,
      jsonNumber: this.extractJsonNumber(githubIssue.body || ''),
      state: githubIssue.state,
    };
  }

  fromDomainListToIssueList(githubIssues: RepoIssue[]): IssueDetails[] {
    return githubIssues.map(issue => this.fromDomainToIssue(issue));
  }

  private extractJsonNumber(body: string): string {
    const contentMatch = body.match(JSON_NUMBER_REGEX)?.[1];

    if (!contentMatch) return '';

    const content = contentMatch.trim();
    return content.replace(ILLEGAL_CHARACTERS_REGEX, '').trim();
  }

  private normalizeLabel = <T extends Partial<Record<'name', string>> | string>(
    label: T,
  ): string => {
    return typeof label === 'string' ? label : label.name || '';
  };
}
