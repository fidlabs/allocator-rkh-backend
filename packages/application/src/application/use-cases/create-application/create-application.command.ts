import { Command, ICommandHandler, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { ILotusClient } from '@src/infrastructure/clients/lotus';
import { TYPES } from '@src/types';
import { PullRequestService } from '@src/application/services/pull-request.service';
import { DatacapAllocator, IDatacapAllocatorRepository } from '@src/domain/application/application';
import { getMultisigInfo } from '@src/infrastructure/clients/filfox';

type Result<T> = {
  success: boolean;
  data?: T;
  error?: Error;
};

export class CreateApplicationCommand extends Command {
  public readonly applicationId: string;
  public readonly applicationNumber: number;
  public readonly applicantName: string;
  public readonly applicantAddress: string;
  public readonly applicantOrgName: string;
  public readonly applicantOrgAddresses: string;
  public readonly allocationTrancheSchedule: string;
  public readonly allocationAudit: string;
  public readonly allocationDistributionRequired: string;
  public readonly allocationRequiredStorageProviders: string;
  public readonly bookkeepingRepo: string;
  public readonly allocationRequiredReplicas: string;
  public readonly datacapAllocationLimits: string;
  public readonly applicantGithubHandle: string;
  public readonly otherGithubHandles: string;
  public readonly onChainAddressForDataCapAllocation: string;

  /**
   * Creates a new CreateApplicationCommand instance.
   * @param data - Partial data to initialize the command.
   */
  constructor(data: Partial<CreateApplicationCommand>) {
    super();
    Object.assign(this, data);
  }
}

@injectable()
export class CreateApplicationCommandHandler implements ICommandHandler<CreateApplicationCommand> {
  commandToHandle: string = CreateApplicationCommand.name;

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly repository: IDatacapAllocatorRepository,
    @inject(TYPES.LotusClient)
    private readonly lotusClient: ILotusClient,
    @inject(TYPES.PullRequestService)
    private readonly pullRequestService: PullRequestService,
  ) {}

  normalizeGithubHandles(input: string): any {
    //extract individual handles from the "additional github handles" airtable field
    if (!input || typeof input !== 'string') return [];

    return input
      .split(/[\s,]+/) // split on commas, spaces, or newlines
      .map(handle => handle.replace(/^@/, '').trim().toLowerCase()) // remove leading @ and normalize
      .filter(Boolean); // remove empty strings
  }

  async handle(command: CreateApplicationCommand): Promise<Result<{ guid: string }>> {
    console.log('command', command);
    let existing: DatacapAllocator | null = null;
    try {
      // Check if the application already exists in the database: this may be a restart
      // of the application, so we need to ensure that we don't create a duplicate entry.
      this.logger.debug(`Getting repository entry for ${command.applicationId}...`);
      const existing = await this.repository.getById(command.applicationId);
      this.logger.debug(
        `Getting repository entry for ${command.applicationId} succeeded. Aborting...`,
      );
      console.log(existing);
      return {
        success: false,
        error: new Error('Application already exists'),
      };
    } catch (error) {
      this.logger.debug(`Getting repository entry for ${command.applicationId} catch`);
      this.logger.debug(error);
    }

    this.logger.debug(`Normalizing ${command.otherGithubHandles}...`);
    const otherHandlesArray = this.normalizeGithubHandles(command.otherGithubHandles);

    this.logger.debug('Creating...');
    try {
      // Create a new datacap allocator
      const allocator: DatacapAllocator = DatacapAllocator.create({
        applicationId: command.applicationId,
        applicationNumber: command.applicationNumber,
        applicantName: command.applicantName,
        applicantAddress: command.applicantAddress,
        applicantOrgName: command.applicantOrgName,
        applicantOrgAddresses: command.applicantOrgAddresses,
        allocationTrancheSchedule: command.allocationTrancheSchedule,
        allocationAudit: command.allocationAudit,
        allocationDistributionRequired: command.allocationDistributionRequired,
        allocationRequiredStorageProviders: command.allocationRequiredStorageProviders,
        bookkeepingRepo: command.bookkeepingRepo,
        allocationRequiredReplicas: command.allocationRequiredReplicas,
        datacapAllocationLimits: command.datacapAllocationLimits,
        applicantGithubHandle: command.applicantGithubHandle,
        otherGithubHandles: otherHandlesArray,
        onChainAddressForDataCapAllocation: command.onChainAddressForDataCapAllocation,
      });
      this.logger.debug('Created...');
      console.log('allocator', allocator);

      if (command.onChainAddressForDataCapAllocation) {
        this.logger.debug(
          `Getting multisig info for ${command.onChainAddressForDataCapAllocation}...`,
        );
        const actorId = await this.lotusClient.getActorId(
          command.onChainAddressForDataCapAllocation,
        );
        this.logger.debug(`Got multisig actor ID ${actorId}`);
        const msigData = await getMultisigInfo(command.onChainAddressForDataCapAllocation);
        this.logger.debug(`Got multisig data}`);
        const signers = msigData.multisig?.signers ?? [];
        const threshold = msigData.multisig?.approvalThreshold ?? 0;
        this.logger.debug(`Setting multisig data`);
        allocator.setAllocatorMultisig(
          actorId,
          command.onChainAddressForDataCapAllocation,
          threshold,
          signers,
        );
      }
      this.logger.info('Creating pull request...');

      try {
        const pullRequest = await this.pullRequestService.createPullRequest(allocator);
        this.logger.info('Pull request created successfully!');
        console.log('pullRequest', pullRequest);
        allocator.setApplicationPullRequest(
          pullRequest.number,
          pullRequest.url,
          pullRequest.commentId,
        );
      } catch (error) {
        console.log('Creating pull request creation error', error);
        console.log('Creating pull request creation error details', (error as any)?.data?.errors);
        this.logger.error(
          'Unable to create application pull request. The application already exists.',
        );
      }
      this.logger.debug('Saving allocator...');
      await this.repository.save(allocator, -1);

      this.logger.debug('Allocator saved!');
      return {
        success: true,
        data: { guid: command.guid },
      };
    } catch (error: any) {
      this.logger.error('Error creating application!');
      this.logger.error(error.message);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
