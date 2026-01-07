import { Command, ICommandBus, Logger } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { Subcall, Message } from '@src/infrastructure/clients/filfox';
import { TYPES } from '@src/types';
import config from '@src/config';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import * as address from '@glif/filecoin-address';
import cbor from 'cbor';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { executeWithFallback } from '@src/patterns/execution/executeWithFallback';
import { IFilfoxClient } from '@src/infrastructure/clients/filfox';
import { PendingTx } from '@src/infrastructure/clients/lotus';
import { SignRefreshByRKHCommand } from './sign-refresh-by-rkh.command';
import { UpdateRKHApprovalsCommand } from './update-rkh-approvals.command';

const RKH_MULTISIG_ACTOR_ADDRESS = 'f080';
const VERIFIED_REGISTRY_ACTOR_METHODS = {
  PROPOSE_ADD_VERIFIER: 2,
  APPROVE_ADD_VERIFIER: 3,
};

export interface ISubMultisigApprovalsSubscriberService {
  start(): NodeJS.Timeout;
  stop(): void;
}

@injectable()
export class SubMultisigApprovalsSubscriberService
  implements ISubMultisigApprovalsSubscriberService
{
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly applicationDetailsRepository: IApplicationDetailsRepository,
    @inject(TYPES.IssueDetailsRepository)
    private readonly issuesRepository: IIssueDetailsRepository,
    @inject(TYPES.FilfoxClient) private readonly filfoxClient: IFilfoxClient,
  ) {}

  start(): NodeJS.Timeout {
    this.logger.info('Starting SubMultisigApprovalsSubscriberService');
    this.intervalId = setInterval(async () => {
      try {
        await this.handle('f03661530');
      } catch (err) {
        this.logger.error('SubMultisigApprovalsSubscriberService uncaught exception:');
        this.logger.error(err);
      }
    }, config.SUBSCRIBE_MULTISIG_APPROVALS_POLLING_INTERVAL);

    return this.intervalId;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async handle(multisigAddress: string): Promise<void> {
    this.logger.info(`Fetching subcalls from ${multisigAddress} for Approve method to f080`);

    const approvedMessages = await this.getAllFilfoxApproveMessages(multisigAddress);
    const subcalls = await this.getSubcallsForApproveMessages(approvedMessages);
    const filteredSubcalls = this.getSubcallsWithProposeAddVerifier(subcalls);
    this.logger.info(
      `Found ${filteredSubcalls.length} subcalls with propose add verifier for ${multisigAddress}`,
    );
    this.logger.info(filteredSubcalls);

    await this.processProposals(filteredSubcalls);
  }

  private async getAllFilfoxApproveMessages(multisigAddress: string): Promise<Message[]> {
    const result = await this.filfoxClient.getFilfoxMessages(multisigAddress, {
      pageSize: 50,
      page: 0,
      method: 'Approve',
    });

    return result?.messages ?? [];
  }

  private async getSubcallsForApproveMessages(approveMessages: Message[]): Promise<Subcall[]> {
    return Promise.allSettled(
      approveMessages.map(message => this.filfoxClient.getSubcalls(message.cid)),
    ).then(results =>
      results.map(result => (result.status === 'fulfilled' ? result.value : [])).flat(),
    );
  }

  private getSubcallsWithProposeAddVerifier(subcalls: Subcall[]): PendingTx[] {
    return subcalls.reduce<PendingTx[]>((acc, subcall) => {
      if (!this.ensureSubcallCorrectAttributes(subcall)) return acc;

      return [
        ...acc,
        {
          id: subcall.decodedReturnValue?.TxId,
          to: subcall.decodedParams.To,
          method: subcall.decodedParams.Method,
          params: subcall.decodedParams.Params,
          value: subcall.decodedParams.Value,
          approved: [subcall.from],
        },
      ];
    }, []);
  }

  private async processProposals(subcalls: PendingTx[]) {
    return Promise.allSettled(subcalls.map(tx => this.processProposal(tx)));
  }

  private async processProposal(tx: PendingTx): Promise<void> {
    const decodedParams = this.decodeParams(tx.params);
    if (!decodedParams) throw new Error('Decoded params are missing');

    const verifier = this.bufferToFilAddress(decodedParams[0]);
    if (!verifier) throw new Error('Verifier address is missing');

    this.logger.info(`Found verifier ${verifier}`);
    await executeWithFallback<Command>({
      primary: () =>
        this.handleSignRKHRefresh({
          address: verifier,
          tx,
        }),
      fallback: () =>
        this.handleSignRKHApplication({
          address: verifier,
          tx,
        }),
      onPrimaryError: error => {
        this.logger.error('Error signing RKH refresh, now checking for application:');
        this.logger.error(error);
      },
      onFallbackError: error => {
        this.logger.error('Both handlers failed:');
        this.logger.error(error);
      },
      onSuccess: command => this.commandBus.send(command),
    });
  }

  private decodeParams(paramsHex: string | undefined): Buffer[] | null {
    if (!paramsHex) return null;

    try {
      const cborHex = paramsHex.replace('0x', '');
      const buffer = Buffer.from(cborHex, 'hex');
      return cbor.decode(buffer);
    } catch (error) {
      this.logger.error(`Error decoding parameters: ${error}`);
      return null;
    }
  }

  private bufferToFilAddress(addressBuffer: Buffer | null): string | null {
    if (!addressBuffer) return null;

    try {
      const addr = new address.Address(addressBuffer);
      return address.encode('f', addr);
    } catch (error) {
      this.logger.error(`Error converting buffer to address: ${error}`);
      return null;
    }
  }

  private ensureSubcallCorrectAttributes(subcall: Subcall): boolean {
    return (
      subcall.to === RKH_MULTISIG_ACTOR_ADDRESS &&
      subcall.method === 'Propose' &&
      subcall.decodedParams.Method === VERIFIED_REGISTRY_ACTOR_METHODS.PROPOSE_ADD_VERIFIER &&
      subcall.toActor === 'multisig'
    );
  }

  private async handleSignRKHRefresh({ tx, address }: { tx: PendingTx; address: string }) {
    const issue = await this.issuesRepository.findPendingBy({ msigAddress: address });
    if (!issue) throw new Error(`Issue not found for address ${address}`);

    return new SignRefreshByRKHCommand(issue, tx);
  }

  private async handleSignRKHApplication({ tx, address }: { tx: PendingTx; address: string }) {
    const applicationDetails = await this.applicationDetailsRepository.getByAddress(address);
    if (!applicationDetails)
      throw new Error(`Application details not found for address ${address}`);

    return new UpdateRKHApprovalsCommand(applicationDetails.id, tx.id, tx.approved, 'Pending');
  }
}
