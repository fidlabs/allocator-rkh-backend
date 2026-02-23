import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { UpsertIssueCommand, UpsertIssueCommandCommandHandler } from './upsert-issue.command';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { FetchAllocatorCommand } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';
import { IAuditMapper } from '@src/infrastructure/mappers/audit-mapper';
import { IUpsertStrategy } from './upsert-issue.strategy';
import { SaveIssueCommand } from './save-issue.command';
import { SaveIssueWithNewAuditCommand } from './save-issue-with-new-audit.command';
import { Address } from 'iso-filecoin';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('guid'),
}));

describe('UpsertIssueCommand', () => {
  let container: Container;
  let handler: UpsertIssueCommandCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const issueMapperMock = { extendWithAllocatorData: vi.fn() };
  const auditMapperMock = {
    fromDomainToAuditData: vi.fn(a => ({
      started: a.started,
      ended: a.ended,
      dcAllocated: a.dc_allocated,
      outcome: a.outcome,
      datacapAmount: a.datacap_amount,
    })),
  };
  const upsertStrategyMock = { resolveAndExecute: vi.fn() };

  const fixtureMsigAddress = `f2${faker.string.alphanumeric(38)}`;
  const fixureAllocatorData = {
    address: fixtureMsigAddress,
    pathway_addresses: { msig: fixtureMsigAddress },
    ma_address: 'f4',
    metapathway_type: 'AMA',
    allocator_id: '1',
    audits: [
      {
        started: '2023-01-01T00:00:00.000Z',
        ended: '2023-01-02T00:00:00.000Z',
        dc_allocated: '2023-01-03T00:00:00.000Z',
        outcome: 'APPROVED',
        datacap_amount: 1,
      },
      {
        started: '2024-01-01T00:00:00.000Z',
        ended: '',
        dc_allocated: '',
        outcome: 'PENDING',
        datacap_amount: 1,
      },
    ],
  };
  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixtureExtendedMappedIssue = {
    ...fixtureIssueDetails,
    Address: fixureAllocatorData.address,
    msigAddress: fixureAllocatorData.pathway_addresses.msig,
    maAddress: fixureAllocatorData.ma_address,
    metapathwayType: fixureAllocatorData.metapathway_type,
    actorId: fixureAllocatorData.allocator_id,
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container.bind<UpsertIssueCommandCommandHandler>(UpsertIssueCommandCommandHandler).toSelf();
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<IIssueMapper>(TYPES.IssueMapper)
      .toConstantValue(issueMapperMock as unknown as IIssueMapper);
    container
      .bind<IAuditMapper>(TYPES.AuditMapper)
      .toConstantValue(auditMapperMock as unknown as IAuditMapper);
    container
      .bind<IUpsertStrategy>(TYPES.UpsertIssueStrategyResolver)
      .toConstantValue(upsertStrategyMock as unknown as IUpsertStrategy);

    handler = container.get<UpsertIssueCommandCommandHandler>(UpsertIssueCommandCommandHandler);

    commandBusMock.send.mockResolvedValue({
      data: fixureAllocatorData,
      success: true,
    });

    upsertStrategyMock.resolveAndExecute.mockResolvedValue(
      new SaveIssueCommand(fixtureExtendedMappedIssue),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully upsert issue', async () => {
    issueMapperMock.extendWithAllocatorData.mockResolvedValue(fixtureExtendedMappedIssue);

    const command = new UpsertIssueCommand(fixtureIssueDetails);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenNthCalledWith(1, expect.any(FetchAllocatorCommand));
    expect(commandBusMock.send).toHaveBeenNthCalledWith(1, {
      jsonNumber: fixtureIssueDetails.jsonNumber,
      guid: expect.any(String),
    });
    expect(commandBusMock.send).toHaveBeenNthCalledWith(2, expect.any(SaveIssueCommand));
    expect(commandBusMock.send).toHaveBeenNthCalledWith(2, {
      guid: 'guid',
      issueDetails: fixtureExtendedMappedIssue,
    });
    expect(result).toStrictEqual({
      success: true,
    });
  });

  it('should catch error when event buss throw and error', async () => {
    issueMapperMock.extendWithAllocatorData.mockResolvedValue(fixtureExtendedMappedIssue);

    const fixtureError = new Error('Failed to fetch');
    commandBusMock.send.mockResolvedValue({ error: fixtureError, success: false });

    const command = new UpsertIssueCommand(fixtureIssueDetails);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(FetchAllocatorCommand));
    expect(commandBusMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonNumber: fixtureIssueDetails.jsonNumber,
        guid: expect.any(String),
      }),
    );
    expect(commandBusMock.send).not.toHaveBeenCalledWith(expect.any(SaveIssueCommand));
    expect(result).toStrictEqual({
      error: fixtureError,
      success: false,
    });
  });

  it('should handle error during command bus send', async () => {
    issueMapperMock.extendWithAllocatorData.mockResolvedValue(fixtureExtendedMappedIssue);

    const error = new Error('Failed to send');
    commandBusMock.send.mockRejectedValue(error);

    const issueDetails = DatabaseRefreshFactory.create();

    const command = new UpsertIssueCommand(issueDetails);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(FetchAllocatorCommand));
    expect(result).toStrictEqual({
      success: false,
      error,
    });
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('should throw and error when issue does not have a jsonNumber', async () => {
    const command = new UpsertIssueCommand({ ...fixtureIssueDetails, jsonNumber: '' });
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(FetchAllocatorCommand));
    expect(commandBusMock.send).not.toHaveBeenCalledWith(expect.any(SaveIssueCommand));
    expect(commandBusMock.send).not.toHaveBeenCalledWith(expect.any(SaveIssueWithNewAuditCommand));
    expect(result).toStrictEqual({
      success: false,
      error: expect.objectContaining({
        message:
          'The JSON number or hash does not exist in the issue template, or it has been added incorrectly.',
      }),
    });
  });
});
