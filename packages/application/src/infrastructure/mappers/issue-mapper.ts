import { IssueDetails } from '@src/infrastructure/respositories/issue-details';
import { RepoIssue } from '@src/infrastructure/clients/github';
import { injectable } from 'inversify';
import {
  JSON_HASH_REGEX,
  NEW_TEMPLATE_JSON_NUMBER_REGEX,
  NEW_TEMPLATE_JSON_SECTION_REGEX,
  OLD_TEMPLATE_JSON_NUMBER_REGEX,
  OLD_TEMPLATE_JSON_SECTION_REGEX,
} from './constants';
import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types';

export interface IIssueMapper {
  fromDomainToIssue(githubIssue: RepoIssue): IssueDetails;

  fromDomainListToIssueList(githubIssues: RepoIssue[]): IssueDetails[];

  extendWithAllocatorData(issue: IssueDetails, allocator: ApplicationPullRequestFile): IssueDetails;

  extractJsonNumber(body: string): string;
}

@injectable()
export class IssueMapper implements IIssueMapper {
  fromDomainToIssue(githubIssue: RepoIssue): IssueDetails {
    return {
      githubIssueId: githubIssue.id,
      githubIssueNumber: githubIssue.number,
      title: githubIssue.title.replace('[DataCap Refresh]', '').trim(),
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

  extendWithAllocatorData(
    issue: IssueDetails,
    allocator: ApplicationPullRequestFile,
  ): IssueDetails {
    return {
      ...issue,
      msigAddress: allocator?.pathway_addresses?.msig,
      maAddress: allocator?.ma_address,
      metapathwayType: allocator?.metapathway_type,
      actorId: allocator?.allocator_id,
    };
  }

  extractJsonNumber(body: string): string {
    const newTemplateSection = body.match(NEW_TEMPLATE_JSON_SECTION_REGEX)?.[0];

    if (newTemplateSection) return this.extractJsonNumberFromNewTemplate(newTemplateSection);

    const oldTemplateSection = body.match(OLD_TEMPLATE_JSON_SECTION_REGEX)?.[0];

    if (oldTemplateSection) return this.extractJsonNumberFromOldTemplate(oldTemplateSection);

    return '';
  }

  private extractJsonNumberFromNewTemplate(body: string): string {
    const hash = body.match(JSON_HASH_REGEX)?.[0] ?? null;

    if (hash) return hash;

    const numericValue = body.match(NEW_TEMPLATE_JSON_NUMBER_REGEX)?.[1] ?? null;

    if (numericValue) return numericValue;

    return '';
  }

  private extractJsonNumberFromOldTemplate(body: string): string {
    const hash = body.match(JSON_HASH_REGEX)?.[0] ?? null;

    if (hash) return hash;

    const numericValue = body.match(OLD_TEMPLATE_JSON_NUMBER_REGEX)?.[1] ?? null;

    if (numericValue) return numericValue;

    return '';
  }

  private normalizeLabel = <T extends Partial<Record<'name', string>> | string>(
    label: T,
  ): string => {
    return typeof label === 'string' ? label : label.name || '';
  };
}
