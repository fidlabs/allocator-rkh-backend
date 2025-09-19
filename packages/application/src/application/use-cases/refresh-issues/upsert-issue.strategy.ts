import { Command, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';
import { WithId } from 'mongodb';
import {
  AuditOutcome,
  FINISHED_REFRESH_STATUSES,
  IssueDetails,
  PENDING_AUDIT_OUTCOMES,
  PENDING_REFRESH_STATUSES,
  RefreshStatus,
} from '@src/infrastructure/repositories/issue-details';
import { SaveIssueCommand } from './save-issue.command';
import { SaveIssueWithNewAuditCommand } from './save-issue-with-new-audit.command';
import { TYPES } from '@src/types';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '@src/constants';
import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types';

const LOG = LOG_MESSAGES.UPSERT_ISSUE_STRATEGY_RESOLVER;
const RES = RESPONSE_MESSAGES.UPSERT_ISSUE_STRATEGY_RESOLVER;

export enum UpsertStrategyKey {
  SAVE_WITH_NEW_AUDIT = 'save-with-new-audit',
  SAVE_WITHOUT_GITHUB_UPDATE = 'save-without-github-update',
}

interface AuditStateAnalysis {
  isCurrentAuditNotFinished: boolean;
  issueByGithubIdExistsInDb: boolean;
  isIssueByGithubIdFinished: boolean;
  currentAllocatorHasPendingRefresh: boolean;
  areTheSameIssue: boolean;
}

export interface IUpsertStrategy {
  execute(issueDetails: IssueDetails): Promise<Command>;
}

@injectable()
export class SaveWithoutGithubUpdateStrategy implements IUpsertStrategy {
  async execute(issueDetails: IssueDetails): Promise<Command> {
    return new SaveIssueCommand(issueDetails);
  }
}

@injectable()
export class SaveWithNewAuditStrategy implements IUpsertStrategy {
  async execute(issueDetails: IssueDetails): Promise<Command> {
    return new SaveIssueWithNewAuditCommand(issueDetails);
  }
}

@injectable()
export class UpsertIssueStrategyResolver {
  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.IssueDetailsRepository)
    private readonly repository: IIssueDetailsRepository,
  ) {}

  public async resolveAndExecute(
    mappedIsuueFromGithub: IssueDetails,
    audits: ApplicationPullRequestFile['audits'],
  ): Promise<Command> {
    this.logger.info(LOG.RESOLVING_UPSERT_ISSUE_STRATEGY);
    const strategyKey = await this.getStrategyKey(mappedIsuueFromGithub, audits);

    this.logger.info(LOG.STRATEGY_SELECTED + strategyKey);

    const strategy = this.getStrategyByKey(strategyKey);
    return strategy.execute(mappedIsuueFromGithub);
  }

  private getStrategyByKey(strategyKey: UpsertStrategyKey): IUpsertStrategy {
    switch (strategyKey) {
      case UpsertStrategyKey.SAVE_WITHOUT_GITHUB_UPDATE:
        return new SaveWithoutGithubUpdateStrategy();
      case UpsertStrategyKey.SAVE_WITH_NEW_AUDIT:
        return new SaveWithNewAuditStrategy();
      default:
        throw new Error(`Unknown strategy key: ${strategyKey}`);
    }
  }

  private async getStrategyKey(
    mappedIsuueFromGithub: IssueDetails,
    audits: ApplicationPullRequestFile['audits'],
  ): Promise<UpsertStrategyKey> {
    const [issueByGithubId, issueWithLatestAuditByJsonNumber] =
      await this.getRelatedIssues(mappedIsuueFromGithub);

    const {
      isCurrentAuditNotFinished,
      issueByGithubIdExistsInDb,
      isIssueByGithubIdFinished,
      currentAllocatorHasPendingRefresh,
      areTheSameIssue,
    } = this.analyzeAuditState(issueByGithubId, issueWithLatestAuditByJsonNumber, audits);

    // if refresh is already finished its not necessary to update the issue
    if (isIssueByGithubIdFinished)
      throw new Error(
        `${mappedIsuueFromGithub.githubIssueNumber} ${RES.ISSUE_REFRESH_ALREADY_FINISHED}`,
      );

    // if issue related to event is same as latest opened refresh, its allowed to update refresh with fresh data
    if (areTheSameIssue && isCurrentAuditNotFinished)
      return UpsertStrategyKey.SAVE_WITHOUT_GITHUB_UPDATE;

    // if issue related to event is same as latest opened refresh, its allowed to update refresh with fresh data
    if (areTheSameIssue && !isCurrentAuditNotFinished) return UpsertStrategyKey.SAVE_WITH_NEW_AUDIT;

    // database records are different, but allocator has pending refresh, its not allowed to create new refresh
    if (currentAllocatorHasPendingRefresh)
      throw new Error(`${mappedIsuueFromGithub.jsonNumber} ${RES.PENDING_AUDIT}`);

    // if issue is not in database yet and there is pending audit, its not allowed to create new refresh
    if (!issueByGithubIdExistsInDb && isCurrentAuditNotFinished)
      throw new Error(`${mappedIsuueFromGithub.jsonNumber} ${RES.PENDING_AUDIT}`);

    // if issue is not in database yet and there is no pending audit, its allowed to create new refresh with new audit
    if (!issueByGithubIdExistsInDb && !isCurrentAuditNotFinished)
      return UpsertStrategyKey.SAVE_WITH_NEW_AUDIT;

    if (issueByGithubIdExistsInDb && !isCurrentAuditNotFinished)
      return UpsertStrategyKey.SAVE_WITH_NEW_AUDIT;

    throw new Error(`${mappedIsuueFromGithub.jsonNumber} ${RES.CANNOT_RESOLVE_UPSERT_STRATEGY}`);
  }

  private analyzeAuditState(
    issueByGithubId: WithId<IssueDetails> | null,
    latestIssueByJsonNumber: WithId<IssueDetails> | null,
    audits: ApplicationPullRequestFile['audits'],
  ): AuditStateAnalysis {
    const currentAudit = audits?.at(-1);

    const isCurrentAuditNotFinished = PENDING_AUDIT_OUTCOMES.includes(
      currentAudit?.outcome as AuditOutcome,
    );

    const issueByGithubIdExistsInDb = !!issueByGithubId;

    const isIssueByGithubIdFinished =
      issueByGithubIdExistsInDb &&
      FINISHED_REFRESH_STATUSES.includes(issueByGithubId.refreshStatus as RefreshStatus);

    const currentAllocatorHasPendingRefresh = PENDING_REFRESH_STATUSES.includes(
      latestIssueByJsonNumber?.refreshStatus as RefreshStatus,
    );

    const areTheSameIssue =
      !!issueByGithubIdExistsInDb &&
      !!latestIssueByJsonNumber &&
      issueByGithubId.githubIssueId === latestIssueByJsonNumber.githubIssueId;

    return {
      isCurrentAuditNotFinished,
      issueByGithubIdExistsInDb,
      isIssueByGithubIdFinished,
      currentAllocatorHasPendingRefresh,
      areTheSameIssue,
    };
  }

  private async getRelatedIssues(
    issueDetails: IssueDetails,
  ): Promise<[WithId<IssueDetails> | null, WithId<IssueDetails> | null]> {
    return await Promise.all([
      this.repository.findBy('githubIssueId', issueDetails.githubIssueId),
      this.repository.findLatestBy('jsonNumber', issueDetails.jsonNumber),
    ]);
  }
}
