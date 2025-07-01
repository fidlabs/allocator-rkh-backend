import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { GithubClient, RepoIssue } from '@src/infrastructure/clients/github';
import { LOG_MESSAGES } from '@src/constants';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { IssueDetails } from '@src/infrastructure/respositories/issue-details';

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
  ) {}

  async handle(command: FetchIssuesCommand) {
    try {
      const repoIssues = await this.handleFetchIssues(command.owner, command.repo);
      const mappedIssues = this.handleMapIssues(repoIssues);
      // const extendedIssues = this.connectAllocatorsToIssues(mappedIssues)

      return {
        data: mappedIssues,
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

  private async handleFetchIssues(owner: string, repo: string): Promise<RepoIssue[]> {
    this.logger.info(LOG.FETCHING_ISSUES);

    const issues = await this.githubClient.getIssues(owner, repo);
    this.logger.info(LOG.ISSUES_RETRIEVED);

    return issues;
  }

  private handleMapIssues(issues: RepoIssue[]): IssueDetails[] {
    this.logger.info(LOG.MAPPING_ISSUES);

    const mappedIssues = this.issueMapper.fromDomainListToIssueList(issues);
    this.logger.info(LOG.ISSUES_MAPPED);

    return mappedIssues;
  }

  /*  async connectAllocatorsToIssues(issuesDetails: IssueDetails[]): Promise<IssueDetails> {
    this.logger.info(LOG.CONNECTING_ALLOCATORS_TO_ISSUES);

    const extendedIssuesPromises = issuesDetails.map((async issue) => {
      const extendedIssueDetails = await this.commandBus.send(new FetchAllocatorCommand(issue.jsonNumber))

      return {
        ...issue,
        allocatorDetails: extendedIssueDetails,
      }
    })

    const extendedIssues = Promise.allSettled(extendedIssuesPromises);
    this.logger.info(LOG.ALLOCATORS_CONNECTED_TO_ISSUES);

    return extendedIssues;
}*/
}
