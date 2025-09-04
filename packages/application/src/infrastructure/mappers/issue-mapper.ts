import { RepoIssue } from '@src/infrastructure/clients/github';
import { IssueDetails } from '@src/infrastructure/repositories/issue-details';
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

  extractJsonIdentifier(body: string): string;
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
      jsonNumber: this.extractJsonIdentifier(githubIssue.body || ''),
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

  /**
   * Extracts the JSON hash, such as 'recBlVFpP7Q3iol1b', from the new template section of the body:
   * ```
   * \n\n### What is your JSON hash (starts with 'rec')\n\nrecwS2sB0UNfqfAVx\n\n
   * ```
   * If the hash is not found, it will attempt to extract the JSON number, e.g. 1005.
   * ```
   * \n\n### What is your JSON hash (starts with 'rec')\n\1005.json\n\n
   * ```
   * This is not a valid json hash, but it is a valid json number.
   *
   * Alternatively, it will attempt to extract the JSON number from the old template section of the body:
   * ```
   * '\n2. **Paste your JSON number:** recBlVFpP7Q3iol1b\n'
   * ```
   * If the hash is not found, it will attempt to extract the JSON number, e.g. 1005.
   * ```
   * '\n2. **Paste your JSON number:** 1005\n'
   * ```
   * This is a fallback for the hash to support JSON files that have not been migrated to the version with the hash.
   * @param body - The body of the issue.
   * @returns The JSON hash or the json number.
   */
  extractJsonIdentifier(body: string): string {
    const newTemplateSection = body.match(NEW_TEMPLATE_JSON_SECTION_REGEX)?.[0];

    if (newTemplateSection)
      return this.extractJsonIdentifierFromTemplate(
        newTemplateSection,
        NEW_TEMPLATE_JSON_NUMBER_REGEX,
      );

    const oldTemplateSection = body.match(OLD_TEMPLATE_JSON_SECTION_REGEX)?.[0];

    if (oldTemplateSection)
      return this.extractJsonIdentifierFromTemplate(
        oldTemplateSection,
        OLD_TEMPLATE_JSON_NUMBER_REGEX,
      );

    return '';
  }

  private extractJsonIdentifierFromTemplate(body: string, jsonNumberRegex: RegExp): string {
    const hash = body.match(JSON_HASH_REGEX)?.[0] ?? null;
    if (hash) return hash;

    const numericValue = body.match(jsonNumberRegex)?.[1] ?? null;
    if (numericValue) return numericValue;
    return '';
  }

  private normalizeLabel = <T extends Partial<Record<'name', string>> | string>(
    label: T,
  ): string => {
    return typeof label === 'string' ? label : label.name || '';
  };
}
