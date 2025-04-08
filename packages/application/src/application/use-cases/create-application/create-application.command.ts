import { Command, ICommandHandler, Logger } from '@filecoin-plus/core'
import { inject, injectable } from 'inversify'

import { ILotusClient } from '@src/infrastructure/clients/lotus'
import { TYPES } from '@src/types'
import { PullRequestService } from '@src/application/services/pull-request.service'
import { DatacapAllocator, IDatacapAllocatorRepository } from '@src/domain/application/application'

type Result<T> = {
  success: boolean
  data?: T
  error?: Error
}

export class CreateApplicationCommand extends Command {
  public readonly applicationId: string
  public readonly applicationNumber: number
  public readonly applicantName: string
  public readonly applicantAddress: string
  public readonly applicantOrgName: string
  public readonly applicantOrgAddresses: string[]
  public readonly allocationTrancheScheduleType: string
  public readonly audit: string
  public readonly distributionRequired: string
  public readonly allocationRequiredStorageProviders: string
  public readonly allocationRequiredReplicas: string
  public readonly datacapAllocationLimits: string
  public readonly applicantGithubHandle: string
  public readonly otherGithubHandles: string[]
  public readonly onChainAddressForDataCapAllocation: string

  /**
   * Creates a new CreateApplicationCommand instance.
   * @param data - Partial data to initialize the command.
   */
  constructor(data: Partial<CreateApplicationCommand>) {
    super()
    Object.assign(this, data)
  }
}

@injectable()
export class CreateApplicationCommandHandler implements ICommandHandler<CreateApplicationCommand> {
  commandToHandle: string = CreateApplicationCommand.name

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
    console.log('command', command)
    try {
      await this.repository.getById(command.applicationId)
      return {
        success: false,
        error: new Error('Application already exists'),
      }
    } catch (error) {}

    try {
      // Create a new datacap allocator
      const allocator: DatacapAllocator = DatacapAllocator.create({
        applicationId: command.applicationId,
        applicationNumber: command.applicationNumber,
        applicantName: command.applicantName,
        applicantAddress: command.applicantAddress,
        applicantOrgName: command.applicantOrgName,
        applicantOrgAddresses: command.applicantOrgAddresses,
        allocationTrancheScheduleType: command.allocationTrancheScheduleType,
        audit: command.audit,
        distributionRequired: command.distributionRequired,
        allocationRequiredStorageProviders: command.allocationRequiredStorageProviders,
        allocationRequiredReplicas: command.allocationRequiredReplicas,
        datacapAllocationLimits: command.datacapAllocationLimits,
        applicantGithubHandle: command.applicantGithubHandle,
        otherGithubHandles: command.otherGithubHandles,
        onChainAddressForDataCapAllocation: command.onChainAddressForDataCapAllocation,
      })

      if (command.onChainAddressForDataCapAllocation) {
        const actorId = await this.lotusClient.getActorId(command.onChainAddressForDataCapAllocation)
        allocator.setAllocatorMultisig(
          actorId,
          command.onChainAddressForDataCapAllocation,
          2,
          [],
        )
      }
      this.logger.info('Creating pull request...')

      try {
        const pullRequest = await this.pullRequestService.createPullRequest(allocator)
        allocator.setApplicationPullRequest(pullRequest.number, pullRequest.url, pullRequest.commentId)
      } catch (error) {
        this.logger.error('Unable to create application pull request. The application already exists.')
      }
      await this.repository.save(allocator, -1)

      return {
        success: true,
        data: { guid: command.guid },
      }
    } catch (error: any) {
      this.logger.error(error.message)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }
}
