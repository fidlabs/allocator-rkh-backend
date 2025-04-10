import { ICommandBus, Logger } from '@filecoin-plus/core'
import { Container } from 'inversify'

import config from '@src/config'
import { IGithubClient } from '@src/infrastructure/clients/github'
import { TYPES } from '@src/types'
import { EditApplicationCommand } from '@src/application/use-cases/edit-application/edit-application.command'
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository'
import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types'

export async function subscribeApplicationEdits(container: Container) {
  const githubClient = container.get<IGithubClient>(TYPES.GithubClient)
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus)
  const applicationRepository = container.get<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)
  const logger = container.get<Logger>(TYPES.Logger)

  // A map of application IDs to their corresponding sha of the allocators.json file
  const applicationCache = new Map<string, string>()

  setInterval(async () => {
    try {
      const applications = await applicationRepository.getAll()

      for (const application of applications) {
        try {
          const pullRequestNumber = application.applicationDetails?.pullRequestNumber
          if (!pullRequestNumber) {
            logger.warn(`No GitHub PR found for application: ${application.id}`)
            continue
          }
          logger.info(application.applicationDetails?.pullRequestUrl)

          // Fetch the PR details
          const prDetails = await githubClient.getPullRequest(
            config.GITHUB_OWNER,
            config.GITHUB_REPO,
            pullRequestNumber,
          )

          // Get the contents of the allocators.json file from the PR branch
          const file = await githubClient.getFile(
            config.GITHUB_OWNER,
            config.GITHUB_REPO,
            `allocators/${application.id}.json`,
            prDetails.head.ref,
          )

          // Check if the sha of the file is the same as the one in the cache
          if (file.sha === applicationCache.get(application.id)) {
            continue
          }

          // Update the cache with the new sha
          applicationCache.set(application.id, file.sha)

          // Parse the JSON content
          const applicationPullRequestFile = JSON.parse(file.content) as ApplicationPullRequestFile

          // Update the application data
          const command = new EditApplicationCommand({
            applicationId: application.id,
            applicationNumber: applicationPullRequestFile.application_number,

            applicantName: applicationPullRequestFile.name,
            applicantGithubHandle: applicationPullRequestFile.application.github_handles[0],
            applicantAddress: applicationPullRequestFile.address,
            applicantOrgName: applicationPullRequestFile.organization,
            applicantOrgAddresses: applicationPullRequestFile.associated_org_addresses,
            allocationStandardizedAllocations: applicationPullRequestFile.application.allocations,
            allocationRequiredReplicas: applicationPullRequestFile.application.required_replicas,
            allocationRequiredStorageProviders: applicationPullRequestFile.application.required_sps,
            allocationTooling: applicationPullRequestFile.application.tooling,
            allocationBookkeepingRepo: applicationPullRequestFile.application.allocation_bookkeeping,
            // applicationInstructions: applicationPullRequestFile.LifeCycle,
          })
          await commandBus.send(command)
        } catch (error: any) {
          logger.error(`Error processing application ${application.id}: ${error.message}`)
        }
      }
    } catch (error: any) {
      logger.error(`Error in subscribeApplicationChanges: ${error.message}`)
    }
  }, config.SUBSCRIBE_APPLICATION_EDITS_POLLING_INTERVAL)
}
