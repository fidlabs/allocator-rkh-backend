import { Command, ICommandHandler, Logger } from '@filecoin-plus/core'
import { inject, injectable } from 'inversify'
import { ApplicationAllocator } from '@src/domain/application/application'
import { ApplicationInstruction, IDatacapAllocatorRepository } from '@src/domain/application/application'
import { TYPES } from '@src/types'

export class EditApplicationCommand extends Command {
  public readonly applicationId: string
  public readonly applicationNumber: number

  public readonly applicantName: string
  public readonly applicantGithubHandle: string
  public readonly applicantSlackHandle: string
  public readonly applicantAddress: string
  public readonly applicantOrgName: string
  public readonly applicantOrgAddresses: string

  public readonly allocationStandardizedAllocations: string[]
  public readonly allocationTargetClients: string[]
  public readonly allocationRequiredReplicas: string
  public readonly allocationRequiredStorageProviders: string
  public readonly allocationTooling: string[]
  public readonly allocationDataTypes: string[]
  public readonly allocationProjected12MonthsUsage: string
  public readonly allocationBookkeepingRepo: string
  public readonly applicationInstructions: ApplicationInstruction[]
  

  /**
   * Creates a new EditApplicationCommand instance.
   * @param data - Partial data to initialize the command.
   */
  constructor(data: Partial<EditApplicationCommand>) {
    super()
    Object.assign(this, data)
  }
}

@injectable()
export class EditApplicationCommandHandler implements ICommandHandler<EditApplicationCommand> {
  commandToHandle: string = EditApplicationCommand.name

  constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
    @inject(TYPES.DatacapAllocatorRepository)
    private readonly repository: IDatacapAllocatorRepository,
  ) { }

  ensureValidApplicationInstruction(
    prevApplicationInstructions: ApplicationInstruction[],
    currApplicationInstructions: ApplicationInstruction[],
  ): ApplicationInstruction[] {

    if (!prevApplicationInstructions) {
      prevApplicationInstructions = []
    }
    // If currApplicationInstruction is empty default to prevApplicationInstruction
    if (!currApplicationInstructions) {
      return prevApplicationInstructions
    }
    // Ensure instruction arrays length >= previous instruction arrays length
    if (currApplicationInstructions.length < prevApplicationInstructions.length) {
      return prevApplicationInstructions
    }
    // Ensure each method and amount is valid
    const validMethods = [ApplicationAllocator.META_ALLOCATOR, ApplicationAllocator.RKH_ALLOCATOR];
    for (let currApplicationInstruction of currApplicationInstructions) {
      let currInstructionMethod: string
      let currInstructionAmount: number
      try {
        currInstructionMethod = currApplicationInstruction.method
        currInstructionAmount = currApplicationInstruction.datacap_amount
      } catch (error) {
        return prevApplicationInstructions
      }
      if (!validMethods.includes(currInstructionMethod as ApplicationAllocator)) {
        return prevApplicationInstructions
      }
      if (!Number.isInteger(currInstructionAmount) || currInstructionAmount <= 0) {
        return prevApplicationInstructions
      }
    }

    return currApplicationInstructions

  }

  async handle(command: EditApplicationCommand): Promise<void> {
    this.logger.info(`Handling edit application command for application ${command.applicationId}`)
    const application = await this.repository.getById(command.applicationId)
    if (!application) {
      this.logger.error('Application not found')
      throw new Error('Application not found')
    }

    const prevApplicationInstructions = application.applicationInstructions
    const currApplicationInstructions = command.applicationInstructions
    console.log('prevApplicationInstructions', prevApplicationInstructions)
    console.log('currApplicationInstructions', currApplicationInstructions)
    const validApplicationInstructions = this.ensureValidApplicationInstruction(prevApplicationInstructions, currApplicationInstructions)
    console.log('validApplicationInstructions', validApplicationInstructions)

    await application.edit({
      applicationNumber: command.applicationNumber,
      applicantName: command.applicantName,
      applicantGithubHandle: command.applicantGithubHandle,
      applicantSlackHandle: command.applicantSlackHandle,
      applicantAddress: command.applicantAddress,
      applicantOrgName: command.applicantOrgName,
      applicantOrgAddresses: command.applicantOrgAddresses,
      allocationStandardizedAllocations: command.allocationStandardizedAllocations,
      allocationTargetClients: command.allocationTargetClients,
      allocationRequiredReplicas: command.allocationRequiredReplicas,
      allocationRequiredStorageProviders: command.allocationRequiredStorageProviders,
      allocationTooling: command.allocationTooling,
      allocationDataTypes: command.allocationDataTypes,
      allocationProjected12MonthsUsage: command.allocationProjected12MonthsUsage,
      allocationBookkeepingRepo: command.allocationBookkeepingRepo,
      applicationInstructions: validApplicationInstructions,
    })
    this.logger.info(`Application ${command.applicationId} edited successfully`)

    await this.repository.save(application, -1)
  }
}
