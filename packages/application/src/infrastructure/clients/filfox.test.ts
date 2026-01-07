import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import { Logger } from '@filecoin-plus/core';

import { TYPES } from '@src/types';
import { FilfoxClient, FilfoxMessages, IFilfoxClient, Subcall } from './filfox';
import { FilfoxClientConfig } from '../interfaces';

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: axiosMocks.get,
  },
}));

describe('FilfoxClient', () => {
  let container: Container;
  let client: IFilfoxClient;
  let filfoxConfig: FilfoxClientConfig;

  const loggerMock = {
    info: vi.fn(),
  };

  const apiBase = 'https://filfox.info/api/v1';

  const makeAxiosMessagesResponse = (overrides: Partial<FilfoxMessages> = {}) => ({
    data: {
      messages: [],
      methods: [],
      totalCount: 0,
      ...overrides,
    } as FilfoxMessages,
  });

  const makeAxiosSubcallsResponse = (overrides: Partial<Subcall[]> = []) => ({
    data: overrides,
  });

  beforeEach(() => {
    container = new Container();

    filfoxConfig = {
      apiBase,
    };

    container.bind<Logger>(TYPES.Logger).toConstantValue(loggerMock as unknown as Logger);
    container
      .bind<FilfoxClientConfig>(TYPES.FilfoxClientConfig)
      .toConstantValue(filfoxConfig as FilfoxClientConfig);
    container.bind<IFilfoxClient>(TYPES.FilfoxClient).to(FilfoxClient);

    client = container.get<IFilfoxClient>(TYPES.FilfoxClient);

    axiosMocks.get.mockReset();
  });

  it('getFilfoxMessages calls axios with merged params and returns data', async () => {
    const address = 'f01234';
    const params = { pageSize: 100, page: 2, method: 'Approve' };
    const expected = {
      messages: ['fixtureMessage'],
      methods: ['Approve'],
      totalCount: 1,
    } as unknown as FilfoxMessages;

    axiosMocks.get.mockResolvedValueOnce(makeAxiosMessagesResponse(expected));

    const result = await client.getFilfoxMessages(address, params);

    expect(axiosMocks.get).toHaveBeenCalledWith(
      `${apiBase}/address/${address}/messages`,
      expect.objectContaining({
        params: expect.objectContaining({
          pageSize: 100,
          page: 2,
          method: 'Approve',
        }),
      }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.stringContaining(`Fetching Filfox messages for ${address}`),
    );
    expect(result).toEqual(expected);
  });

  it('getFilfoxMessages falls back to empty object when response data is undefined', async () => {
    const address = 'f01234';

    axiosMocks.get.mockResolvedValueOnce({ data: undefined });

    const result = await client.getFilfoxMessages(address, {});

    expect(result).toEqual({});
  });

  it('getSubcalls calls axios and returns subcalls data', async () => {
    const cid = 'bafy2bzacecid';
    const fixtureSubcalls = ['fixtureSubcall'] as unknown as Subcall[];

    axiosMocks.get.mockResolvedValueOnce(makeAxiosSubcallsResponse(fixtureSubcalls));

    const result = await client.getSubcalls(cid);

    expect(axiosMocks.get).toHaveBeenCalledWith(`${apiBase}/message/${cid}/subcalls`);
    expect(loggerMock.info).toHaveBeenCalledWith(`Fetching Filfox subcalls for ${cid}`);
    expect(result).toEqual(fixtureSubcalls);
  });

  it('getSubcalls falls back to empty array when response data is undefined', async () => {
    const cid = 'bafy2bzacecid';

    axiosMocks.get.mockResolvedValueOnce({ data: undefined });

    const result = await client.getSubcalls(cid);

    expect(result).toEqual([]);
  });
});
