import {
  createWinstonLogger,
  ICommand,
  ICommandBus,
  ICommandHandler,
  IEventHandler,
  IQuery,
  IQueryBus,
  IQueryHandler,
  Logger,
} from '@filecoin-plus/core';
import { Container } from 'inversify';

import { infrastructureModule } from '@src/infrastructure/module';
import {
  AllocatorMultisigUpdated,
  ApplicationCreated,
  ApplicationEdited,
  ApplicationPullRequestUpdated,
  DatacapAllocationUpdated,
  DatacapRefreshRequested,
  GovernanceReviewApproved,
  GovernanceReviewRejected,
  GovernanceReviewStarted,
  KYCApproved,
  KYCRejected,
  KYCRevoked,
  KYCStarted,
  MetaAllocatorApprovalCompleted,
  MetaAllocatorApprovalStarted,
  RKHApprovalCompleted,
  RKHApprovalStarted,
  RKHApprovalsUpdated,
} from '@src/domain/application/application.events';
import { TYPES } from '@src/types';
import {
  AllocatorMultisigUpdatedEventHandler,
  ApplicationEditedEventHandler,
  ApplicationPullRequestUpdatedEventHandler,
  DatacapAllocationUpdatedEventHandler,
  DatacapRefreshRequestedEventHandler,
  GovernanceReviewApprovedEventHandler,
  GovernanceReviewRejectedEventHandler,
  GovernanceReviewStartedEventHandler,
  KYCApprovedEventHandler,
  KYCRejectedEventHandler,
  KYCRevokedEventHandler,
  KYCStartedEventHandler,
  MetaAllocatorApprovalCompletedEventHandler,
  MetaAllocatorApprovalStartedEventHandler,
  RKHApprovalCompletedEventHandler,
  RKHApprovalStartedEventHandler,
  RKHApprovalsUpdatedEventHandler,
} from './application/events/handlers';
import { UpdateRKHApprovalsCommandHandler } from './application/use-cases/update-rkh-approvals/update-rkh-approvals.command';
import { SubmitGovernanceReviewResultCommandHandler } from './application/use-cases/submit-governance-review/submit-governance-review.command';
import { ApplicationCreatedEventHandler } from './application/use-cases/create-application/application-created.event';
import { CreateApplicationCommandHandler } from './application/use-cases/create-application/create-application.command';
import { MessageService } from './application/services/message.service';
import { PullRequestService } from './application/services/pull-request.service';
import { SubmitKYCResultCommandHandler } from './application/use-cases/submit-kyc-result/submit-kyc-result.command';
import { GetApplicationsQueryHandler } from './application/queries/get-applications/get-applications.query';
import { EditApplicationCommandHandler } from './application/use-cases/edit-application/edit-application.command';
import { UpdateDatacapAllocationCommandHandler } from './application/use-cases/update-datacap-allocation/update-datacap-allocation';
import { UpdateMetaAllocatorApprovalsCommandHandler } from './application/use-cases/update-ma-approvals/update-ma-approvals.command';
import { CreateRefreshApplicationCommandHandler } from './application/use-cases/create-application/create-refresh-application.command';
import { RoleService } from './application/services/role.service';
import { RevokeKYCCommandHandler } from '@src/application/use-cases/revoke-kyc/revoke-kyc.command';
import { RefreshIssuesCommandHandler } from '@src/application/use-cases/refresh-issues/refresh-issues.command';
import { FetchIssuesCommandHandler } from '@src/application/use-cases/refresh-issues/fetch-issues.command';
import { BulkCreateIssueCommandHandler } from '@src/application/use-cases/refresh-issues/bulk-create-issue.command';
import { GetRefreshesQueryHandler } from '@src/application/queries/get-refreshes/get-refreshes.query';
import { UpsertIssueCommandCommandHandler } from '@src/application/use-cases/refresh-issues/upsert-issue.command';
import { FetchAllocatorCommandHandler } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';
import { SignRefreshByRKHCommandHandler } from '@src/application/use-cases/update-rkh-approvals/sign-refresh-by-rkh.command';
import { ApproveRefreshByRKHCommandHandler } from '@src/application/use-cases/update-rkh-approvals/approve-refresh-by-rkh.command';
import { ApproveRefreshByMaCommandHandler } from '@src/application/use-cases/update-ma-approvals/approve-refresh-by-ma.command';
import { MaService } from './application/services/meta-allocator.service';

export const initialize = async (): Promise<Container> => {
  const container = new Container();

  await container.loadAsync(infrastructureModule);

  // Logger
  const logger = createWinstonLogger('filecoin-plus-backend');
  container.bind<Logger>(TYPES.Logger).toConstantValue(logger);

  container.bind<PullRequestService>(TYPES.PullRequestService).to(PullRequestService);
  container.bind<RoleService>(TYPES.RoleService).to(RoleService);
  container.bind<MessageService>(TYPES.MessageService).to(MessageService);
  container.bind<MaService>(TYPES.MaService).to(MaService);

  container.bind<IEventHandler<ApplicationCreated>>(TYPES.Event).to(ApplicationCreatedEventHandler);
  container.bind<IEventHandler<ApplicationEdited>>(TYPES.Event).to(ApplicationEditedEventHandler);
  container
    .bind<IEventHandler<ApplicationPullRequestUpdated>>(TYPES.Event)
    .to(ApplicationPullRequestUpdatedEventHandler);
  container
    .bind<IEventHandler<AllocatorMultisigUpdated>>(TYPES.Event)
    .to(AllocatorMultisigUpdatedEventHandler);

  // TODO: V1 Bind KYC events to their handlers
  container.bind<IEventHandler<KYCStarted>>(TYPES.Event).to(KYCStartedEventHandler);
  container.bind<IEventHandler<KYCApproved>>(TYPES.Event).to(KYCApprovedEventHandler);
  container.bind<IEventHandler<KYCRejected>>(TYPES.Event).to(KYCRejectedEventHandler);
  container.bind<IEventHandler<KYCRevoked>>(TYPES.Event).to(KYCRevokedEventHandler);

  // TODO: V1 Bind Governance events to their handlers
  container
    .bind<IEventHandler<GovernanceReviewStarted>>(TYPES.Event)
    .to(GovernanceReviewStartedEventHandler);
  container
    .bind<IEventHandler<GovernanceReviewApproved>>(TYPES.Event)
    .to(GovernanceReviewApprovedEventHandler);
  container
    .bind<IEventHandler<GovernanceReviewRejected>>(TYPES.Event)
    .to(GovernanceReviewRejectedEventHandler);

  container.bind<IEventHandler<RKHApprovalStarted>>(TYPES.Event).to(RKHApprovalStartedEventHandler);
  container
    .bind<IEventHandler<RKHApprovalsUpdated>>(TYPES.Event)
    .to(RKHApprovalsUpdatedEventHandler);
  container
    .bind<IEventHandler<RKHApprovalCompleted>>(TYPES.Event)
    .to(RKHApprovalCompletedEventHandler);
  container
    .bind<IEventHandler<DatacapAllocationUpdated>>(TYPES.Event)
    .to(DatacapAllocationUpdatedEventHandler);

  container
    .bind<IEventHandler<MetaAllocatorApprovalStarted>>(TYPES.Event)
    .to(MetaAllocatorApprovalStartedEventHandler);
  container
    .bind<IEventHandler<MetaAllocatorApprovalCompleted>>(TYPES.Event)
    .to(MetaAllocatorApprovalCompletedEventHandler);

  container
    .bind<IEventHandler<DatacapRefreshRequested>>(TYPES.Event)
    .to(DatacapRefreshRequestedEventHandler);

  // Commands
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(CreateApplicationCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(CreateRefreshApplicationCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(EditApplicationCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(SubmitKYCResultCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(RevokeKYCCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(SubmitGovernanceReviewResultCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(UpdateRKHApprovalsCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(UpdateDatacapAllocationCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(UpdateMetaAllocatorApprovalsCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(RefreshIssuesCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(FetchIssuesCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(BulkCreateIssueCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(UpsertIssueCommandCommandHandler);
  container.bind<ICommandHandler<ICommand>>(TYPES.CommandHandler).to(FetchAllocatorCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(SignRefreshByRKHCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(ApproveRefreshByRKHCommandHandler);
  container
    .bind<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .to(ApproveRefreshByMaCommandHandler);

  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  container
    .getAll<ICommandHandler<ICommand>>(TYPES.CommandHandler)
    .forEach((handler: ICommandHandler<ICommand>) => {
      commandBus.registerHandler(handler);
    });

  container.bind<IQueryHandler<IQuery>>(TYPES.QueryHandler).to(GetApplicationsQueryHandler);
  container.bind<IQueryHandler<IQuery>>(TYPES.QueryHandler).to(GetRefreshesQueryHandler);

  const queryBus = container.get<IQueryBus>(TYPES.QueryBus);
  container
    .getAll<IQueryHandler<IQuery>>(TYPES.QueryHandler)
    .forEach((handler: IQueryHandler<IQuery>) => {
      queryBus.registerHandler(handler);
    });

  return container;
};
