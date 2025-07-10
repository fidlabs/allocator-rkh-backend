import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import { components } from '@octokit/openapi-types';
import { inject, injectable } from 'inversify';
import { TYPES } from '@src/types';
import { createAppAuth } from '@octokit/auth-app';

const ThrottledOctokit = Octokit.plugin(throttling);

export type Branch = components['schemas']['git-ref'];
export type PullRequest = components['schemas']['pull-request'];
export type PullRequestReview = components['schemas']['pull-request-review'];
export type RepoIssue = components['schemas']['issue'];
export type IssuesWebhookPayload = {
  action:
    | 'opened'
    | 'edited'
    | 'closed'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'milestoned'
    | 'demilestoned'
    | 'locked'
    | 'unlocked'
    | 'transferred'
    | 'pinned'
    | 'unpinned'
    | 'deleted';
  issue: components['schemas']['issue'];
  repository: components['schemas']['repository'];
  sender: components['schemas']['simple-user'];
};
export type File = {
  sha: string;
  content: string;
};

export interface IGithubClient {
  createBranch(
    owner: string,
    repo: string,
    branchName: string,
    baseBranch: string,
  ): Promise<Branch>;

  deleteBranch(owner: string, repo: string, branchName: string): Promise<void>;

  createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
    files: { path: string; content: string }[],
  ): Promise<PullRequest>;

  updatePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    title?: string,
    body?: string,
    files?: { path: string; content: string }[],
  ): Promise<PullRequest>;

  closePullRequest(owner: string, repo: string, pullNumber: number): Promise<void>;

  createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<PullRequestReview>;

  updatePullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    commentId: number,
    body: string,
  ): Promise<PullRequestReview>;

  updatePullRequestReviewers(
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ): Promise<void>;

  getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestReview[]>;

  mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    commitMessage: string,
  ): Promise<void>;

  getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest>;

  getFile(owner: string, repo: string, path: string, ref: string): Promise<File>;

  getIssues(owner: string, repo: string, lables: string[]): Promise<RepoIssue[]>;
}

/**
 * Configuration options for GithubClient
 */
export interface GithubClientConfig {
  appId: string;
  appPrivateKey: string;
  appInstallationId: string;
  githubToken?: string;
}

/**
 * Implements IGithubClient using the Octokit library.
 */
@injectable()
export class GithubClient implements IGithubClient {
  private octokit: Octokit;

  constructor(
    @inject(TYPES.GithubClientConfig)
    config: GithubClientConfig,
  ) {
    const throttleConfig = {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

        if (retryCount < 1) {
          // only retries once
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        // does not retry, only logs a warning
        octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
        );
      },
    };

    if (config.githubToken) {
      this.octokit = new ThrottledOctokit({ auth: config.githubToken, throttle: throttleConfig });
    } else {
      this.octokit = new ThrottledOctokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.appId,
          privateKey: config.appPrivateKey,
          installationId: config.appInstallationId,
        },
        throttle: throttleConfig,
      });
    }
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    baseBranch: string,
  ): Promise<Branch> {
    // Get the latest commit SHA of the base branch.
    const sha = await this.getCommitSha(owner, repo, baseBranch);

    // Create a new branch with the latest commit SHA.
    const { data } = await this.octokit.git.createRef({
      owner: owner,
      repo: repo,
      ref: `refs/heads/${branchName}`,
      sha: sha,
    });

    return data;
  }

  async deleteBranch(owner: string, repo: string, branchName: string): Promise<void> {
    await this.octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
    files: { path: string; content: string }[],
  ): Promise<PullRequest> {
    // Create or update files in the branch
    for (const file of files) {
      await this.createOrUpdateFile(owner, repo, file.path, file.content, head);
    }

    // Create the pull request
    const { data } = await this.octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });

    return data;
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    title?: string,
    body?: string,
    files?: { path: string; content: string }[],
  ): Promise<PullRequest> {
    // Update files if provided
    if (files) {
      // Get the PR details to get the head branch
      const pr = await this.getPullRequest(owner, repo, pullNumber);
      const headBranch = pr.head.ref;

      // Update each file in the branch
      for (const file of files) {
        await this.createOrUpdateFile(owner, repo, file.path, file.content, headBranch);
      }
    }

    const updateParams: {
      owner: string;
      repo: string;
      pull_number: number;
      title?: string;
      body?: string;
    } = {
      owner,
      repo,
      pull_number: pullNumber,
    };

    if (title) updateParams.title = title;
    if (body) updateParams.body = body;

    const { data } = await this.octokit.pulls.update(updateParams);
    return data;
  }

  async closePullRequest(owner: string, repo: string, pullNumber: number): Promise<void> {
    await this.octokit.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      state: 'closed',
    });
  }

  async createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<PullRequestReview> {
    console.log(`>>> Creating Review! <<< ${owner}, ${repo}, ${pullNumber}, ${body}`);
    const { data } = await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event: 'COMMENT',
    });

    return data;
  }

  async updatePullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    commentId: number,
    body: string,
  ): Promise<PullRequestReview> {
    console.log(`>>> Updating Review! <<< ${owner}, ${repo}, ${pullNumber}, ${commentId}, ${body}`);
    const { data } = await this.octokit.pulls.updateReview({
      owner,
      repo,
      pull_number: pullNumber,
      review_id: commentId,
      body,
    });

    return data;
  }

  async updatePullRequestReviewers(
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ): Promise<void> {
    await this.octokit.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pullNumber,
      reviewers,
    });
  }

  async getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestReview[]> {
    const { data } = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return data;
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    commitMessage: string,
  ): Promise<void> {
    await this.octokit.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      commit_message: commitMessage,
    });
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      return data;
    } catch (error: any) {
      console.error(`Error fetching PR details: ${error.message}`);
      throw error;
    }
  }

  async getFile(owner: string, repo: string, path: string, ref?: string): Promise<File> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ('content' in data) {
        return {
          sha: data.sha,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        };
      } else {
        throw new Error('File content not found');
      }
    } catch (error: any) {
      console.error(`Error fetching file content: ${error.message}`);
      throw error;
    }
  }

  async getIssues(owner: string, repo: string): Promise<RepoIssue[]> {
    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state: 'open',
      });
      return data;
    } catch (error: any) {
      console.error(`Error fetching issues: ${error.message}`);
      throw error;
    }
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    branch: string,
  ): Promise<void> {
    let sha: string | undefined;

    try {
      // Try to get existing file to obtain its SHA
      const existingFile = await this.getFile(owner, repo, path, branch);
      sha = existingFile.sha;
    } catch (error) {
      // File doesn't exist yet, which is fine
    }

    await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Add/update ${path}`,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha ? { sha } : {}), // Include SHA only if file exists
    });
  }

  private async getCommitSha(owner: string, repo: string, branch: string): Promise<string> {
    const { data } = await this.octokit.git.getRef({
      owner: owner,
      repo: repo,
      ref: `heads/${branch}`,
    });
    return data.object.sha;
  }
}
