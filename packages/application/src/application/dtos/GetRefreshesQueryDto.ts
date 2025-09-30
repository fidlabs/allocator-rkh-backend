import { RefreshStatus } from '@src/infrastructure/repositories/issue-details';

export interface GetRefreshesQueryDto {
  page: string;
  limit: string;
  search?: string;
  status?: RefreshStatus[];
}
