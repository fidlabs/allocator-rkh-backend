import { ApplicationStatus, ApplicationInstruction } from '@src/domain/application/application'


interface ApplicationDetails {
  id: string
  number: number
  name: string
  organization: string
  actorId?: string
  address: string
  github: string
  allocationTrancheScheduleType: string
  datacap: number
  status: ApplicationStatus
  applicationDetails?: {
    pullRequestUrl: string
    pullRequestNumber: number
  }
  rkhPhase?: {
    approvals: string[]
    approvalThreshold?: number
    approvalMessageId?: number
  }
  applicationInstructions?: ApplicationInstruction[],
  datacapInfo?: {
    latestDatacap: number,
    latestUpdateBlock: number,
  },
}

export { ApplicationDetails }
