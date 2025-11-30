import { Command, ICommandHandler, Logger, Result } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { ILotusClient } from '@src/infrastructure/clients/lotus';
import { TYPES } from '@src/types';
import { PullRequest, PullRequestService } from '@src/application/services/pull-request.service';
import { DatacapAllocator, IDatacapAllocatorRepository } from '@src/domain/application/application';
import { getMultisigInfo } from '@src/infrastructure/clients/filfox';

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

  async handle(command: CreateApplicationCommand): Promise<Result<{ guid: string }>> {
    this.logger.info('CreateApplicationCommandHandler');
    this.logger.debug(command);

    if (await this.doesApplicationExist(command)) {
      return {
        success: false,
        error: new Error('Application already exists'),
      };
    }

    try {
      const otherHandlesArray = this.normalizeGithubHandles(command.otherGithubHandles);
      const newAllocator = await this.prepareNewDatacapAllocator(command, otherHandlesArray);

      if (command.onChainAddressForDataCapAllocation) {
        const multisigData = await this.prepareAllocatorMultisig(command);
        newAllocator.setAllocatorMultisig(
          multisigData.actorId,
          multisigData.multisigAddress,
          multisigData.threshold,
          multisigData.signers,
        );
      }

      const pullRequestResult = await this.createApplicationPullRequest(newAllocator);
      if (pullRequestResult.success) {
        newAllocator.setApplicationPullRequest(
          pullRequestResult.data.number,
          pullRequestResult.data.url,
          pullRequestResult.data.commentId,
        );
      }

      this.logger.debug('Saving allocator...');
      await this.repository.save(newAllocator, -1);

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

  normalizeGithubHandles(input: string): string[] {
    this.logger.info(`Normalizing ${input}...`);
    //extract individual handles from the "additional github handles" airtable field
    if (!input || typeof input !== 'string') return [];

    return input
      .split(/[\s,]+/) // split on commas, spaces, or newlines
      .map(handle => handle.replace(/^@/, '').trim().toLowerCase()) // remove leading @ and normalize
      .filter(Boolean); // remove empty strings
  }

  private async doesApplicationExist(command: CreateApplicationCommand): Promise<boolean> {
    try {
      // Check if the application already exists in the database: this may be a restart
      // of the application, so we need to ensure that we don't create a duplicate entry.
      this.logger.info(`Getting repository entry for ${command.applicationId}...`);
      const existing = await this.repository.getById(command.applicationId);
      this.logger.info(
        `Getting repository entry for ${command.applicationId} succeeded. Aborting...`,
      );
      this.logger.debug(existing);
      return true;
    } catch (error) {
      this.logger.error(`Getting repository entry for ${command.applicationId} catch`);
      this.logger.error(error);
      return false;
    }
  }

  private async prepareNewDatacapAllocator(
    command: CreateApplicationCommand,
    otherHandlesArray: string[],
  ) {
    this.logger.info('Creating...');
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
    this.logger.info('Created...');
    this.logger.debug(allocator);

    return allocator;
  }

  private async prepareAllocatorMultisig(command: CreateApplicationCommand) {
    this.logger.info(`Getting multisig info for ${command.onChainAddressForDataCapAllocation}...`);

    const actorId = await this.lotusClient.getActorId(command.onChainAddressForDataCapAllocation);
    this.logger.info(`Got multisig actor ID ${actorId}`);

    const msigData = await getMultisigInfo(command.onChainAddressForDataCapAllocation);
    this.logger.info(`Got multisig data`);
    this.logger.debug(msigData);

    const signers = (msigData.multisig as { signers: string[] })?.signers ?? [];
    const threshold = (msigData.multisig as { approvalThreshold: number })?.approvalThreshold ?? 0;
    this.logger.info(`Setting multisig data`);

    return {
      actorId,
      multisigAddress: command.onChainAddressForDataCapAllocation,
      threshold,
      signers,
    };
  }

  private async createApplicationPullRequest(
    allocator: DatacapAllocator,
  ): Promise<Result<PullRequest>> {
    this.logger.info('Creating pull request...');

    try {
      const pullRequest = await this.pullRequestService.createPullRequest(allocator);
      this.logger.info('Pull request created successfully!');
      this.logger.debug(pullRequest);

      return {
        success: true,
        data: pullRequest,
      };
    } catch (error) {
      this.logger.error('Creating pull request creation error', error);
      this.logger.error(
        'Creating pull request creation error details',
        (error as any)?.data?.errors,
      );
      this.logger.error(
        'Unable to create application pull request. The application already exists.',
      );

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
