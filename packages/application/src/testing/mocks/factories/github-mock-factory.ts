import { vi } from 'vitest';

export class GithubMockFactory {
  static create() {
    return {
      createBranch: vi.fn(),
      deleteBranch: vi.fn(),
      createPullRequest: vi.fn(),
      updatePullRequest: vi.fn(),
      closePullRequest: vi.fn(),
      createPullRequestComment: vi.fn(),
      updatePullRequestComment: vi.fn(),
      updatePullRequestReviewers: vi.fn(),
      getPullRequestReviews: vi.fn(),
      mergePullRequest: vi.fn(),
      getPullRequest: vi.fn(),
      getFile: vi.fn(),
      getIssues: vi.fn(),
    };
  }
}
