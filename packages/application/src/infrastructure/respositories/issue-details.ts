import { ApplicationPullRequestFile } from '@src/application/services/pull-request.types';

interface User {
  userId: number;
  name: string;
}

export interface IssueDetails {
  githubIssueId: number;
  title: string;
  creator: User;
  assignees: User[] | null;
  labels: string[] | null;
  state: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  closedAt: Date | null;
  jsonNumber: string;
  allocatorDetails?: ApplicationPullRequestFile;
}
