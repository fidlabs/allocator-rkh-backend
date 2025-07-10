import { Command, ICommandBus, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { GithubClient, RepoIssue } from '@src/infrastructure/clients/github';
import { LOG_MESSAGES } from '@src/constants';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';
import { FetchAllocatorCommand } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';
import { ISSUE_TITLE_REGEX } from '@src/infrastructure/mappers/constants';

const LOG = LOG_MESSAGES.FETCH_ISSUES_COMMAND;

export class FetchIssuesCommand extends Command {
  constructor(
    public readonly owner: string,
    public readonly repo: string,
  ) {
    super();
  }
}

@injectable()
export class FetchIssuesCommandHandler implements ICommandHandler<FetchIssuesCommand> {
  commandToHandle: string = FetchIssuesCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.GithubClient) private readonly githubClient: GithubClient,
    @inject(TYPES.IssueMapper) private readonly issueMapper: IIssueMapper,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
  ) {}

  async handle(command: FetchIssuesCommand) {
    try {
      const repoIssues = await this.handleFetchIssues(command.owner, command.repo);
      const filteredIssues = this.filterIssuesByTitle(repoIssues);
      const mappedIssues = this.handleMapIssues(filteredIssues);
      const settledExtendedIssues = await this.connectMsigsToIssues(mappedIssues);
      const issuesWithCorrectAllocatorJson =
        this.omitIssuesWithoutCorrectAllocatorJson(settledExtendedIssues);

      return {
        data: issuesWithCorrectAllocatorJson,
        success: true,
      };
    } catch (e) {
      this.logger.info(LOG.FAILED_TO_GET_ISSUES, e);
      return {
        success: false,
        error: e,
      };
    }
  }

  async connectMsigsToIssues(
    issuesDetails: IssueDetails[],
  ): Promise<PromiseSettledResult<IssueDetails>[]> {
    this.logger.info(LOG.CONNECTING_ALLOCATORS_TO_ISSUES);

    const extendedIssuesPromises = issuesDetails.map(async issue => {
      if (!issue.jsonNumber) throw new Error('Issue does not have a jsonNumber');

      const commandResponse = await this.commandBus.send(
        new FetchAllocatorCommand(issue.jsonNumber),
      );

      if (!commandResponse.success) throw commandResponse.error;

      const extendedIssue: IssueDetails = {
        ...issue,
        msigAddress: commandResponse.data.pathway_addresses.msig,
      };

      return extendedIssue;
    });

    const settledResults = await Promise.allSettled(extendedIssuesPromises);
    this.logger.info(LOG.ALLOCATORS_CONNECTED_TO_ISSUES);

    return settledResults;
  }

  private async handleFetchIssues(owner: string, repo: string): Promise<RepoIssue[]> {
    this.logger.info(LOG.FETCHING_ISSUES);

    const issues = await this.githubClient.getIssues(owner, repo);
    this.logger.info(LOG.ISSUES_RETRIEVED);

    return issues;
  }

  private filterIssuesByTitle(issues: RepoIssue[]): RepoIssue[] {
    return issues.filter(issue => issue.title.match(ISSUE_TITLE_REGEX));
  }

  private handleMapIssues(issues: RepoIssue[]): IssueDetails[] {
    this.logger.info(LOG.MAPPING_ISSUES);

    const mappedIssues = this.issueMapper.fromDomainListToIssueList(issues);
    this.logger.info(LOG.ISSUES_MAPPED);

    return mappedIssues;
  }

  private omitIssuesWithoutCorrectAllocatorJson(
    results: PromiseSettledResult<IssueDetails>[],
  ): IssueDetails[] {
    return results.reduce(
      (acc: IssueDetails[], result: PromiseSettledResult<IssueDetails>) =>
        result.status === 'fulfilled' ? [...acc, result.value] : acc,
      [],
    );
  }
}
