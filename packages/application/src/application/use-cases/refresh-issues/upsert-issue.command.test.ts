import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { ICommandBus, Logger } from '@filecoin-plus/core';
import { TYPES } from '@src/types';
import { UpsertIssueCommand, UpsertIssueCommandCommandHandler } from './upsert-issue.command';
import { IIssueDetailsRepository } from '@src/infrastructure/repositories/issue-details.repository';
import { DatabaseRefreshFactory } from '@mocks/factories';
import { faker } from '@faker-js/faker';
import { FetchAllocatorCommand } from '@src/application/use-cases/fetch-allocator/fetch-allocator.command';
import { IIssueMapper } from '@src/infrastructure/mappers/issue-mapper';

describe('UpsertIssueCommand', () => {
  let container: Container;
  let handler: UpsertIssueCommandCommandHandler;
  const loggerMock = { info: vi.fn(), error: vi.fn() };
  const repositoryMock = { save: vi.fn() };
  const commandBusMock = { send: vi.fn() };
  const issueMapperMock = { extendWithAllocatorData: vi.fn() };

  const fixtureMsigAddress = `f2${faker.string.alphanumeric(38)}`;
  const fixureAllocatorData = {
    pathway_addresses: { msig: fixtureMsigAddress },
    ma_address: 'f4',
    metapathway_type: 'msig',
    allocator_id: '1',
  };
  const fixtureIssueDetails = DatabaseRefreshFactory.create();
  const fixtureExtendedMappedIssue = {
    ...fixtureIssueDetails,
    msigAddress: fixureAllocatorData.pathway_addresses.msig,
    maAddress: fixureAllocatorData.ma_address,
    metapathwayType: fixureAllocatorData.metapathway_type,
    actorId: fixureAllocatorData.allocator_id,
  };

  beforeEach(() => {
    container = new Container();

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<IIssueDetailsRepository>(TYPES.IssueDetailsRepository)
      .toConstantValue(repositoryMock as unknown as IIssueDetailsRepository);
    container.bind<UpsertIssueCommandCommandHandler>(UpsertIssueCommandCommandHandler).toSelf();
    container
      .bind<ICommandBus>(TYPES.CommandBus)
      .toConstantValue(commandBusMock as unknown as ICommandBus);
    container
      .bind<IIssueMapper>(TYPES.IssueMapper)
      .toConstantValue(issueMapperMock as unknown as IIssueMapper);

    handler = container.get<UpsertIssueCommandCommandHandler>(UpsertIssueCommandCommandHandler);

    commandBusMock.send.mockResolvedValue({
      data: fixureAllocatorData,
      success: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully upsert issue', async () => {
    issueMapperMock.extendWithAllocatorData.mockResolvedValue(fixtureExtendedMappedIssue);

    const command = new UpsertIssueCommand(fixtureIssueDetails);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(FetchAllocatorCommand));
    expect(commandBusMock.send).toBeCalledWith(
      expect.objectContaining({
        jsonNumber: fixtureIssueDetails.jsonNumber,
        guid: expect.any(String),
      }),
    );
    expect(repositoryMock.save).toHaveBeenCalledWith({
      ...fixtureExtendedMappedIssue,
      msigAddress: fixtureMsigAddress,
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
    expect(commandBusMock.send).toBeCalledWith(
      expect.objectContaining({
        jsonNumber: fixtureIssueDetails.jsonNumber,
        guid: expect.any(String),
      }),
    );
    expect(repositoryMock.save).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      error: fixtureError,
      success: false,
    });
  });

  it('should handle error during issue upsert', async () => {
    issueMapperMock.extendWithAllocatorData.mockResolvedValue(fixtureExtendedMappedIssue);

    const error = new Error('Failed to save');
    repositoryMock.save.mockRejectedValue(error);

    const issueDetails = DatabaseRefreshFactory.create();

    const command = new UpsertIssueCommand(issueDetails);
    const result = await handler.handle(command);

    expect(commandBusMock.send).toHaveBeenCalledWith(expect.any(FetchAllocatorCommand));
    expect(commandBusMock.send).toBeCalledWith(
      expect.objectContaining({
        jsonNumber: issueDetails.jsonNumber,
        guid: expect.any(String),
      }),
    );
    expect(repositoryMock.save).toHaveBeenCalledWith(fixtureExtendedMappedIssue);
    expect(result).toStrictEqual({
      success: false,
      error,
    });
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('should throw and error when issue does not have a jsonNumber', async () => {
    const command = new UpsertIssueCommand({ ...fixtureIssueDetails, jsonNumber: '' });
    const result = await handler.handle(command);

    expect(commandBusMock.send).not.toHaveBeenCalled();
    expect(repositoryMock.save).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: false,
      error: expect.objectContaining({
        message:
          'The JSON number or hash does not exist in the issue template, or it has been added incorrectly.',
      }),
    });
  });
});
