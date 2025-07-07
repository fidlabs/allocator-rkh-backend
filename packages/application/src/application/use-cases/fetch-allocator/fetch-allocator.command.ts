import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { GithubClient } from '@src/infrastructure/clients/github';
import { LOG_MESSAGES } from '@src/constants';
import config from '@src/config';
import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types';

const LOG = LOG_MESSAGES.FETCH_ALLOCATOR_COMMAND;

export class FetchAllocatorCommand extends Command {
  constructor(public readonly jsonNumber: string) {
    super();
  }
}

@injectable()
export class FetchAllocatorCommandHandler implements ICommandHandler<FetchAllocatorCommand> {
  commandToHandle: string = FetchAllocatorCommand.name;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.GithubClient) private readonly githubClient: GithubClient,
  ) {}

  async handle(command: FetchAllocatorCommand) {
    try {
      const jsonFile = await this.handleFetchAllocatorFile(command.jsonNumber);
      const githubAllocator = await this.mapFileToJson(jsonFile);

      return {
        data: githubAllocator,
        success: true,
      };
    } catch (e) {
      this.logger.info(LOG.FAILED_TO_GET_ALLOCATOR, e);
      return {
        success: false,
        error: e,
      };
    }
  }

  private async handleFetchAllocatorFile(jsonNumber: string): Promise<unknown> {
    this.logger.info(LOG.FETCHING_ALLOCATOR);

    const jsonfile = await this.githubClient.getFile(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      `Allocators/${jsonNumber}.json`,
    );
    this.logger.info(LOG.ALLOCATOR_FILE_RETRIEVED);

    return jsonfile;
  }

  private async mapFileToJson(file: unknown): Promise<ApplicationPullRequestFile> {
    this.logger.info(LOG.ALLOCATOR_FILE_MAPPING);

    const applicationPullRequestFile = JSON.parse((file as Record<'content', string>)?.content);
    this.logger.info(LOG.ALLOCATOR_FILE_MAPPED);

    return applicationPullRequestFile as ApplicationPullRequestFile;
  }
}
