import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { SignatureGuard, SignatureType } from './signature-guard.decorator';

const mocks = vi.hoisted(() => ({
  mockVerifyLedgerPoP: vi.fn(),
  mockBadRequest: vi.fn(),
  mockResponse: {
    res: {
      status: vi.fn(() => mocks.mockResponse.res),
      json: vi.fn(() => mocks.mockResponse.res),
    },
  },
  mockOriginal: vi.fn(),
}));

vi.mock('@src/api/http/controllers/authutils', () => ({
  verifyLedgerPoP: mocks.mockVerifyLedgerPoP,
}));

vi.mock('@src/api/http/processors/response', () => ({
  badRequest: mocks.mockBadRequest,
}));

describe('SignatureGuard', () => {
  const fixtureId = 'refresh-123';
  const fixtureDto = {
    result: 'Approved',
    details: {
      reviewerAddress: 'f1address',
      reviewerPublicKey: '04abcdef',
      signature: '0xsig',
      finalDataCap: 1024,
      allocatorType: 'RKH',
    },
  };
  class TestController {
    @SignatureGuard(SignatureType.RefreshReview)
    handler(...args: unknown[]) {
      return mocks.mockOriginal(...args);
    }
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls original method when signature verification succeeds', async () => {
    mocks.mockVerifyLedgerPoP.mockResolvedValue(true);
    mocks.mockOriginal.mockResolvedValue('ok');

    const controller = new TestController();

    const result = await controller.handler(
      fixtureId,
      fixtureDto,
      mocks.mockResponse.res as unknown as Response,
      'rest',
    );

    expect(mocks.mockVerifyLedgerPoP).toHaveBeenCalledOnce();
    expect(mocks.mockOriginal).toHaveBeenCalledOnce();
    expect(result).toBe('ok');
  });

  it('returns 403 when verification returns false', async () => {
    mocks.mockVerifyLedgerPoP.mockResolvedValue(false);
    mocks.mockOriginal.mockResolvedValue('ok');

    const controller = new TestController();

    await controller.handler(fixtureId, fixtureDto, mocks.mockResponse.res, 'rest');

    expect(mocks.mockVerifyLedgerPoP).toHaveBeenCalledOnce();
    expect(mocks.mockOriginal).not.toHaveBeenCalled();
    expect(mocks.mockResponse.res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when verifyLedgerPoP throws Error', async () => {
    mocks.mockVerifyLedgerPoP.mockRejectedValue(new Error('Error'));
    mocks.mockOriginal.mockResolvedValue('ok');

    const controller = new TestController();

    await controller.handler(fixtureId, fixtureDto, mocks.mockResponse.res, 'rest');

    expect(mocks.mockVerifyLedgerPoP).toHaveBeenCalledOnce();
    expect(mocks.mockOriginal).not.toHaveBeenCalled();
    expect(mocks.mockResponse.res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when verifyLedgerPoP throws non-Error', async () => {
    mocks.mockVerifyLedgerPoP.mockRejectedValue('non-Error');

    const controller = new TestController();

    await controller.handler(fixtureId, fixtureDto, mocks.mockResponse.res, 'rest');

    expect(mocks.mockVerifyLedgerPoP).toHaveBeenCalledOnce();
    expect(mocks.mockOriginal).not.toHaveBeenCalled();
    expect(mocks.mockResponse.res.status).toHaveBeenCalledWith(400);
  });
});
