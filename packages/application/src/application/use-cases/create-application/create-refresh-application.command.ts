import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { PullRequestService } from '@src/application/services/pull-request.service';
import {
  ApplicationStatus,
  DatacapAllocator,
  IDatacapAllocatorRepository,
} from '@src/domain/application/application';
import { GovernanceReviewStarted } from '@src/domain/application/application.events';

type Result<T> = {
  success: boolean;
  data?: T;
  error?: Error;
};

export class CreateRefreshApplicationCommand extends Command {
  constructor(public readonly applicationId: string) {
    super();
  }
}

@injectable()
export class CreateRefreshApplicationCommandHandler
  implements ICommandHandler<CreateRefreshApplicationCommand>
{
  commandToHandle: string = CreateRefreshApplicationCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly repository: IDatacapAllocatorRepository,
    @inject(TYPES.PullRequestService)
    private readonly pullRequestService: PullRequestService,
  ) {}

  async handle(command: CreateRefreshApplicationCommand): Promise<Result<{ guid: string }>> {
    /*
    Explanation:

    - Create a PR with title 'Refresh allocator' to indicate a refresh request.
    - Update the PR with a comment setting the status to GOVERNANCE_REVIEW_PHASE.

    Note(s):

    1. Updating ApplicationDetailsRepository:
      - setApplicationPullRequest is called after making a pull request and updates
        the status (to GOVERNANCE_REVIEW_PHASE) and PR details in MongoDB.
    2. Updating DatacapAllocatorRepository:
      - allocator status is updated to GOVERNANCE_REVIEW_PHASE.
      - repository.save() called to commit allocator changes.
    */

    this.logger.info('Handling CreateRefreshApplicationCommand...');
    let allocator: DatacapAllocator;
    try {
      allocator = await this.repository.getById(command.applicationId);
    } catch (error) {
      this.logger.error(`Error finding allocator with applicationId ${command.applicationId}`);
      return {
        success: false,
        error: new Error('Application not found'),
      };
    }
    try {
      this.logger.info('Creating refresh application pull request...');
      // TODO: Emit RefreshSubmssionStarted event => logs to database
      // allocator.applyGovernanceReviewStarted(new GovernanceReviewStarted(allocator.guid))

      // NOTE: A 'refresh' flag was added to allocator. If 'true' it enables createPullRequest
      // and updatePullRequest to set the correct title.
      allocator.refresh = true; // Set refresh flag

      const pullRequest = await this.pullRequestService.createPullRequest(allocator);
      allocator.setApplicationPullRequest(
        pullRequest.number,
        pullRequest.url,
        pullRequest.commentId,
        allocator.refresh,
      );
      allocator.requestDatacapRefresh();

      await this.repository.save(allocator, -1);
      allocator.refresh = false; // Reset refresh flag

      return {
        success: true,
        data: { guid: command.guid },
      };
    } catch (error: any) {
      this.logger.error(error.message);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
