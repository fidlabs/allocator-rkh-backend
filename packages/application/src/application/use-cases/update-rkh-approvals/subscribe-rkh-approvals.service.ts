// FIXME create a proper injectable service for this file
import { Command, ICommandBus, Logger } from '@filecoin-plus/core';
import { Container } from 'inversify';

import { ApprovedTx, ILotusClient, PendingTx } from '@src/infrastructure/clients/lotus';
import { TYPES } from '@src/types';
import { methods as m } from 'filecoin-verifier-tools';
import config from '@src/config';
import { UpdateRKHApprovalsCommand } from './update-rkh-approvals.command';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import * as address from '@glif/filecoin-address';
import cbor from 'cbor';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { ApproveRefreshByRKHCommand } from '@src/application/use-cases/update-rkh-approvals/approve-refresh-by-rkh.command';
import { SignRefreshByRKHCommand } from '@src/application/use-cases/update-rkh-approvals/sign-refresh-by-rkh.command';
import { executeWithFallback } from '@src/patterns/execution/executeWithFallback';

const RKH_MULTISIG_ACTOR_ADDRESS = 'f080';
const VERIFIED_REGISTRY_ACTOR_METHODS = {
  PROPOSE_ADD_VERIFIER: 2,
  APPROVE_ADD_VERIFIER: 3,
};

const getVerifierFromParams = (params: string, logger: Logger): string => {
  const paramsBytes = Uint8Array.from(Buffer.from(params, 'base64'));
  const paramsCbor = cbor.decode(paramsBytes);

  // TODO we should decode this through the methods.decode() function but
  // at time of writing it doesn't cope with F4s so unroll it by hand
  // Should be 2 buffers, first is the address, second is the datacap. If any of that
  // fails we can quietly ignore it
  if (!Array.isArray(paramsCbor) || paramsCbor.length !== 2) {
    logger.debug('Ignoring malformed addVerifier message');
    return '';
  }

  const addressParam = 0;

  try {
    logger.debug(`Trying to construct address from ${paramsCbor[addressParam]}`);
    const addr = new address.Address(paramsCbor[addressParam]);
    const verifier = address.encode('f', addr);
    return verifier;
  } catch (err) {
    logger.debug('Could not extract address from CBOR', paramsCbor);
    return '';
  }
};

const getProposalIdFromParams = (params: string, logger: Logger): number => {
  const paramsBytes = Uint8Array.from(Buffer.from(params, 'base64'));
  const paramsCbor = cbor.decode(paramsBytes);

  const proposalIdParam = 0;

  try {
    logger.debug(`Trying to find proposal ID from ${paramsCbor[proposalIdParam]}`);
    return paramsCbor[proposalIdParam];
  } catch (err) {
    logger.info('Could not extract proposal ID from CBOR');
    logger.debug(params);
    logger.debug(paramsCbor);
    logger.debug(paramsCbor[proposalIdParam]);
    return 0;
  }
};

async function findProcessApprovals(
  lotusClient: ILotusClient,
  commandBus: ICommandBus,
  applicationDetailsRepository: IApplicationDetailsRepository,
  issuesRepository: IIssueDetailsRepository,
  methods: any,
  logger: Logger,
) {
  const msigState = await lotusClient.getMultisig(RKH_MULTISIG_ACTOR_ADDRESS);
  logger.debug(`msigState is: ${JSON.stringify(msigState)}`);

  // First do pending ones, to update the m-of-n state
  logger.debug(`Found ${msigState.pendingTxs.length} pending transactions`);
  for (const tx of msigState.pendingTxs) {
    try {
      logger.info(`Processing pending transaction: ${JSON.stringify(tx)}`);

      if (
        tx.to != config.VERIFIED_REGISTRY_ACTOR_ADDRESS ||
        tx.method != VERIFIED_REGISTRY_ACTOR_METHODS.PROPOSE_ADD_VERIFIER
      ) {
        logger.info('Skipping irrelevant RKH multisig proposal');
        logger.debug(tx);
      }

      // Parse the params from the pending tx and extract the verifier address
      const verifier = getVerifierFromParams(tx.params, logger);
      logger.info(`Found verifier ${verifier}`);
      await executeWithFallback<Command>({
        primary: () =>
          handleSignRKHRefresh({
            address: verifier,
            issuesRepository,
            tx,
          }),
        fallback: () =>
          handleSignRKHApplication({
            address: verifier,
            applicationDetailsRepository,
            tx,
          }),
        onPrimaryError: error =>
          logger.error('Error signing RKH refresh, now checking for application:', error),
        onFallbackError: error => logger.error('Both handlers failed:', error),
        onSuccess: command => commandBus.send(command),
      });
    } catch (error) {
      logger.error('Error updating RKH open proposals', { error });
    }
  }

  // Now do recently completed ones
  logger.debug(`Found ${msigState.approvedTxs.length} approved transactions`);
  for (const tx of msigState.approvedTxs) {
    try {
      // If the last person approves rather than adding to the proposal count
      // then what we get doesn't include the actual address or params, it's just
      // an approval on the proposal ID
      const proposal = getProposalIdFromParams(tx.params, logger);
      await executeWithFallback<Command>({
        primary: () =>
          handleApproveRKHRefresh({
            approvalId: proposal,
            issuesRepository,
            tx,
          }),
        fallback: () =>
          handleApproveRKHApplication({
            proposal,
            applicationDetailsRepository,
          }),
        onPrimaryError: error =>
          logger.error('Error approving RKH refresh, now checking for application', error),
        onFallbackError: error => logger.error('Both handlers failed', error),
        onSuccess: command => commandBus.send(command),
      });
    } catch (error) {
      logger.error('Error updating RKH completed approvals', { error });
      // swallow and move on to the next one, it's probably just not for us
    }
  }
}

//FIXME create a service for this subscriber
export async function subscribeRKHApprovals(container: Container) {
  const methods = (await m()).mainnet;

  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const logger = container.get<Logger>(TYPES.Logger);
  const applicationDetailsRepository = container.get<IApplicationDetailsRepository>(
    TYPES.ApplicationDetailsRepository,
  );
  const issuesRepository = container.get<IIssueDetailsRepository>(TYPES.IssueDetailsRepository);
  const lotusClient = container.get<ILotusClient>(TYPES.LotusClient);

  logger.info('Subscribing to RKH proposals');
  setInterval(async () => {
    try {
      await findProcessApprovals(
        lotusClient,
        commandBus,
        applicationDetailsRepository,
        issuesRepository,
        methods,
        logger,
      );
    } catch (err) {
      logger.error('subscribeRKHApprovals uncaught exception:');
      logger.error(err);
      // swallow error and wait for next tick
    }
  }, config.SUBSCRIBE_RKH_APPROVALS_POLLING_INTERVAL);
}

export async function handleSignRKHRefresh({
  tx,
  address,
  issuesRepository,
}: {
  tx: PendingTx;
  address: string;
  issuesRepository: IIssueDetailsRepository;
}) {
  const issue = await issuesRepository.findSignedBy({ msigAddress: address });
  if (!issue) throw new Error(`Issue not found for address ${address}`);

  return new SignRefreshByRKHCommand(issue, tx);
}

export async function handleSignRKHApplication({
  tx,
  address,
  applicationDetailsRepository,
}: {
  tx: PendingTx;
  address: string;
  applicationDetailsRepository: IApplicationDetailsRepository;
}) {
  const applicationDetails = await applicationDetailsRepository.getByAddress(address);
  if (!applicationDetails) throw new Error(`Application details not found for address ${address}`);

  return new UpdateRKHApprovalsCommand(applicationDetails.id, tx.id, tx.approved, 'Pending');
}

export async function handleApproveRKHRefresh({
  tx,
  approvalId,
  issuesRepository,
}: {
  tx: ApprovedTx;
  approvalId: number;
  issuesRepository: IIssueDetailsRepository;
}) {
  const issue = await issuesRepository.findSignedBy({ rkhPhase: { messageId: approvalId } });
  if (!issue) throw new Error(`Issue not found for approval ID ${approvalId}`);

  return new ApproveRefreshByRKHCommand(issue, tx);
}

export async function handleApproveRKHApplication({
  proposal,
  applicationDetailsRepository,
}: {
  proposal: number;
  applicationDetailsRepository: IApplicationDetailsRepository;
}) {
  const applicationDetails = await applicationDetailsRepository.getByProposalId(proposal);

  if (!applicationDetails) throw new Error(`Application not found for proposal ID ${proposal}`);
  if (applicationDetails.status == 'DC_ALLOCATED') throw new Error('Application already approved');
  return new UpdateRKHApprovalsCommand(applicationDetails.id, 0, [], 'Approved');
}
