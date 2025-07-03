interface User {
  userId: number;
  name: string;
}

export interface IssueDetails {
  githubIssueId: number;
  githubIssueNumber: number;
  title: string;
  creator: User;
  assignees: User[] | null;
  labels: string[] | null;
  state: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  closedAt: Date | null;
  jsonNumber: string;
  msigAddress?: string;
}
