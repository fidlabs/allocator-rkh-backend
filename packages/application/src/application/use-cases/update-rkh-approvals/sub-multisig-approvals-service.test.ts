import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { SubMultisigApprovalsSubscriberService } from './sub-multisig-approvals-service';
import { IFilfoxClient, Message, Subcall } from '@src/infrastructure/clients/filfox';
import { IApplicationDetailsRepository } from '@src/infrastructure/repositories/application-details.repository';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { PendingTx } from '@src/infrastructure/clients/lotus';
import { SignRefreshByRKHCommand } from './sign-refresh-by-rkh.command';
import { UpdateRKHApprovalsCommand } from './update-rkh-approvals.command';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';

vi.mock('@src/config', () => ({
  default: {
    SUBSCRIBE_MULTISIG_APPROVALS_POLLING_INTERVAL: 1000,
  },
}));

describe('SubMultisigApprovalsSubscriberService', () => {
  let container: Container;
  let service: SubMultisigApprovalsSubscriberService;

  const loggerMock = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  const filfoxClientMock = {
    getFilfoxMessages: vi.fn(),
    getSubcalls: vi.fn(),
  };

  const commandBusMock = { send: vi.fn() };
  const applicationDetailsRepositoryMock = { getByAddress: vi.fn() };
  const issuesRepositoryMock = { findPendingBy: vi.fn() };
  const multisigAddress = 'f03661530';
  const verifierAddress = 'f410fw325e6novwl57jcsbhz6koljylxuhqq5jnp5ftq';
  const messageCid = 'bafy2bzaceexample';

  const fixtureMessage: Message = {
    cid: messageCid,
    height: 12345,
    timestamp: Date.now(),
    from: multisigAddress,
    to: 'f080',
    nonce: 1,
    value: '0',
    method: 'Approve',
    evmMethod: '',
    params: '',
    receipt: {
      exitCode: 0,
      return: '',
    },
  };

  const fixtureSubcall: Subcall = {
    from: multisigAddress,
    fromId: multisigAddress,
    fromActor: 'multisig',
    to: 'f080',
    toId: 'f080',
    toActor: 'multisig',
    value: '0',
    method: 'Propose',
    methodNumber: 2,
    params:
      '0x84420006400258228256040ab6f5d279aead97dfa45209f3e53969c2ef43c21d490006bc000000000000',
    receipt: {
      exitCode: 0,
      return: '',
    },
    decodedParams: {
      Method: 2,
      Params: '0x8256040ab6f5d279aead97dfa45209f3e53969c2ef43c21d490006bc000000000000',
      To: 'f06',
      Value: '0',
    },
    decodedReturnValue: {
      TxId: 123,
      Applied: false,
      ExitCode: 0,
      Ret: '0x',
    },
    subcalls: [],
  };

  const fixtureIssue = DatabaseRefreshFactory.create({
    msigAddress: verifierAddress,
  });

  const fixtureApplicationDetails = {
    id: faker.string.uuid(),
    address: verifierAddress,
    status: 'PENDING',
  };

  beforeEach(() => {
    container = new Container();

    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IFilfoxClient>(TYPES.FilfoxClient)
      .toConstantValue(filfoxClientMock as unknown as IFilfoxClient);
    container
      .bind<IApplicationDetailsRepository>(TYPES.ApplicationDetailsRepository)
      .toConstantValue(
        applicationDetailsRepositoryMock as unknown as IApplicationDetailsRepository,
      );
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(issuesRepositoryMock as unknown as IIssueDetailsRepository);

    container
      .bind<SubMultisigApprovalsSubscriberService>(TYPES.SubMultisigApprovalsSubscriberService)
      .to(SubMultisigApprovalsSubscriberService);

    service = container.get<SubMultisigApprovalsSubscriberService>(
      TYPES.SubMultisigApprovalsSubscriberService,
    );

    filfoxClientMock.getFilfoxMessages.mockResolvedValue({
      messages: [fixtureMessage],
      methods: ['Approve'],
      totalCount: 1,
    });
    filfoxClientMock.getSubcalls.mockResolvedValue([fixtureSubcall]);
    issuesRepositoryMock.findPendingBy.mockResolvedValue(fixtureIssue);
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.stop();
  });

  describe('start', () => {
    it('should start the interval and return timeout id', () => {
      vi.useFakeTimers();
      const intervalId = service.start();

      expect(intervalId).toBeDefined();
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Starting SubMultisigApprovalsSubscriberService',
      );

      vi.useRealTimers();
    });

    it('should call handle method on interval', async () => {
      vi.useFakeTimers();
      const handleSpy = vi.spyOn(service, 'handle').mockResolvedValue();

      service.start();
      await vi.advanceTimersByTimeAsync(1000);

      expect(handleSpy).toHaveBeenCalledWith('f03661530');

      vi.useRealTimers();
      handleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should clear interval when stop is called', () => {
      vi.useFakeTimers();
      const intervalId = service.start();
      expect(intervalId).toBeDefined();

      service.stop();
      expect(() => service.stop()).not.toThrow();

      vi.useRealTimers();
    });
  });

  describe('handle', () => {
    it('should process proposals successfully when issue is found', async () => {
      await service.handle(multisigAddress);

      expect(filfoxClientMock.getFilfoxMessages).toHaveBeenCalledWith(multisigAddress, {
        pageSize: 50,
        page: 0,
        method: 'Approve',
      });
      expect(filfoxClientMock.getSubcalls).toHaveBeenCalledWith(messageCid);
      expect(issuesRepositoryMock.findPendingBy).toHaveBeenCalledWith({
        msigAddress: verifierAddress,
      });
      expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(SignRefreshByRKHCommand));
    });

    it('should process proposals successfully when application is found (fallback)', async () => {
      issuesRepositoryMock.findPendingBy.mockResolvedValue(null);
      applicationDetailsRepositoryMock.getByAddress.mockResolvedValue(fixtureApplicationDetails);

      await service.handle(multisigAddress);

      expect(applicationDetailsRepositoryMock.getByAddress).toHaveBeenCalledWith(verifierAddress);
      expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(UpdateRKHApprovalsCommand));
    });

    it('should handle empty messages', async () => {
      filfoxClientMock.getFilfoxMessages.mockResolvedValue({
        messages: [],
        methods: [],
        totalCount: 0,
      });

      await service.handle(multisigAddress);

      expect(filfoxClientMock.getSubcalls).not.toHaveBeenCalled();
      expect(commandBusMock.send).not.toHaveBeenCalled();
    });

    it('should filter subcalls correctly', async () => {
      const invalidSubcall: Subcall = {
        ...fixtureSubcall,
        to: 'f099',
        method: 'Other',
      };

      filfoxClientMock.getSubcalls.mockResolvedValue([fixtureSubcall, invalidSubcall]);

      await service.handle(multisigAddress);

      expect(commandBusMock.send).toHaveBeenCalledTimes(1);
      expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(SignRefreshByRKHCommand));
    });

    it('should handle errors during processing gracefully', async () => {
      filfoxClientMock.getFilfoxMessages.mockRejectedValue(new Error('API Error'));

      await expect(service.handle(multisigAddress)).rejects.toThrow('API Error');
    });

    it('should handle both handlers failing', async () => {
      issuesRepositoryMock.findPendingBy.mockResolvedValue(null);
      applicationDetailsRepositoryMock.getByAddress.mockResolvedValue(null);

      await service.handle(multisigAddress);

      expect(loggerMock.error).toHaveBeenCalledWith('Both handlers failed:');
      expect(commandBusMock.send).not.toHaveBeenCalled();
    });

    it('should process multiple subcalls', async () => {
      const secondSubcall: Subcall = {
        ...fixtureSubcall,
        decodedReturnValue: {
          ...fixtureSubcall.decodedReturnValue!,
          TxId: 456,
        },
      };

      filfoxClientMock.getSubcalls.mockResolvedValue([fixtureSubcall, secondSubcall]);

      await service.handle(multisigAddress);

      expect(commandBusMock.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSubcallsWithProposeAddVerifier', () => {
    it('should filter subcalls with correct attributes', async () => {
      const validSubcall: Subcall = {
        ...fixtureSubcall,
        to: 'f080',
        method: 'Propose',
        decodedParams: {
          Method: 2,
          Params: '0x8256040ab6f5d279aead97dfa45209f3e53969c2ef43c21d490006bc000000000000',
          To: 'f06',
          Value: '0',
        },
        toActor: 'multisig',
      };

      const invalidSubcall: Subcall = {
        ...fixtureSubcall,
        to: 'f099',
        method: 'Other',
        decodedParams: {
          Method: 3,
          Params: '',
          To: 'f06',
          Value: '0',
        },
      };

      filfoxClientMock.getSubcalls.mockResolvedValue([validSubcall, invalidSubcall]);

      await service.handle(multisigAddress);

      expect(commandBusMock.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('processProposal', () => {
    it('should create SignRefreshByRKHCommand when issue exists', async () => {
      await service.handle(multisigAddress);

      const sentCommand = commandBusMock.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(SignRefreshByRKHCommand);
    });

    it('should create UpdateRKHApprovalsCommand when application exists', async () => {
      issuesRepositoryMock.findPendingBy.mockResolvedValue(null);
      applicationDetailsRepositoryMock.getByAddress.mockResolvedValue(fixtureApplicationDetails);

      await service.handle(multisigAddress);

      const sentCommand = commandBusMock.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(UpdateRKHApprovalsCommand);
    });
  });
});
