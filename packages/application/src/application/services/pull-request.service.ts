import { inject, injectable } from 'inversify'

import { ApplicationStatus, DatacapAllocator } from '@src/domain/application/application'
import { IGithubClient } from '@src/infrastructure/clients/github'
import { TYPES } from '@src/types'
import { Logger } from '@filecoin-plus/core'
import config from '@src/config'
import { MessageService } from './message.service'
import { mapApplicationToPullRequestFile } from './pull-request.types'

export type PullRequest = {
  number: number
  url: string
  commentId: number
}

@injectable()
export class PullRequestService {
  constructor(
    @inject(TYPES.Logger) private readonly _logger: Logger,
    @inject(TYPES.GithubClient) private readonly _githubClient: IGithubClient,
    @inject(TYPES.MessageService) private readonly _messageService: MessageService,
  ) {}

  async createPullRequest(application: DatacapAllocator): Promise<PullRequest> {
    const branchName = `add-allocator-${application.guid}/${application.grantCycle}`
    this._logger.debug(`Creating branch: ${branchName}`)

    try {
      await this._githubClient.createBranch(config.GITHUB_OWNER, config.GITHUB_REPO, branchName, 'main')
    } catch (error: any) {
      if (error.message.includes('Reference already exists')) {
        this._logger.error('Branch already exists, deleting...')
        await this._githubClient.deleteBranch(config.GITHUB_OWNER, config.GITHUB_REPO, branchName)
        await this._githubClient.createBranch(config.GITHUB_OWNER, config.GITHUB_REPO, branchName, 'main')
        this._logger.error('Branch recreated')
      } else {
        this._logger.error(`Error creating pull request: ${error}`)
        throw error
      }
    }
    let title: string
    if (application.applicationInstructions.length > 1) {
      title = `Refresh allocator: ${application.applicantName}`
    } else {
      title = `Add new allocator: ${application.applicantName}`
    }
    this._logger.debug(`Creating pull request for application: ${application.guid}`)
    this._logger.debug(`Pull request title: ${title}`)
    const pullRequest = await this._githubClient.createPullRequest(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      title,
      this._messageService.generatePullRequestMessage(application),
      branchName,
      'main',
      [
        {
          path: `Allocators/${application.guid}.json`,
          content: JSON.stringify(await mapApplicationToPullRequestFile(application), null, 2),
        },
      ],
    )
    this._logger.debug(`Creating comment on pull request: ${pullRequest.number}`)
    const prComment = await this._githubClient.createPullRequestComment(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      pullRequest.number,
      this._messageService.generateCommentMessage(application),
    )
    this._logger.debug(`Pull request comment created: ${prComment.id}`)

    return {
      number: pullRequest.number,
      url: pullRequest.url,
      commentId: prComment.id,
    }
  }

  async updatePullRequest(application: DatacapAllocator): Promise<void> {
    if (!application.applicationPullRequest?.prNumber) return

    this._logger.debug(`Updating pull request message: ${application.applicationPullRequest?.prNumber}`)
    console.log('Updating pull request message:', application)
    let title: string
    if (application.refresh) {
      title = `Refresh allocator: ${application.applicantName}`
    } else {
      title = `Add new allocator: ${application.applicantName}`
    }

    await this._githubClient.updatePullRequest(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      application.applicationPullRequest.prNumber,
      title,
      this._messageService.generatePullRequestMessage(application),
      [
        {
          path: `Allocators/${application.guid}.json`,
          content: JSON.stringify(await mapApplicationToPullRequestFile(application), null, 2),
        },
      ],
    )

    this._logger.debug(`Updating pull request comment: ${application.applicationPullRequest.commentId}`)
    console.log(application.applicationInstructions)
    await this._githubClient.updatePullRequestComment(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      application.applicationPullRequest.prNumber,
      application.applicationPullRequest.commentId,
      this._messageService.generateCommentMessage(application),
    )

    if (application.applicationStatus === ApplicationStatus.GOVERNANCE_REVIEW_PHASE) {
      try {
        // Add reviewers to the pull request
        await this._githubClient.updatePullRequestReviewers(
          config.GITHUB_OWNER,
          config.GITHUB_REPO,
          application.applicationPullRequest.prNumber,
          config.GOVERNANCE_TEAM_GITHUB_HANDLES,
        )
      } catch (error: any) {
        this._logger.warn(`Unable to add reviewers to pull request: ${error}`)
      }
    }

    if (application.applicationStatus === ApplicationStatus.REJECTED) {
      try {
        await this.closePullRequest(application)
      } catch (error: any) {}
    }

    if (application.applicationStatus === ApplicationStatus.APPROVED) {
      try {
        await this.mergePullRequest(application)
      } catch (error: any) {}
    }
  }

  async mergePullRequest(allocator: DatacapAllocator): Promise<void> {
    this._logger.debug(`Merging pull request: ${allocator.applicationPullRequest.prNumber}`)
    await this._githubClient.mergePullRequest(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      allocator.applicationPullRequest.prNumber,
      'Automatically merged after RKH approval',
    )
  }

  async closePullRequest(allocator: DatacapAllocator): Promise<void> {
    this._logger.debug(`Closing pull request: ${allocator.applicationPullRequest.prNumber}`)
    await this._githubClient.closePullRequest(
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      allocator.applicationPullRequest.prNumber,
    )
  }
}
