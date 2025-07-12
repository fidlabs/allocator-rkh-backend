import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeWithFallback } from './executeWithFallback';

describe('executeWithFallback', () => {
  let primarySpy: ReturnType<typeof vi.fn>;
  let fallbackSpy: ReturnType<typeof vi.fn>;
  let onPrimaryErrorSpy: ReturnType<typeof vi.fn>;
  let onFallbackErrorSpy: ReturnType<typeof vi.fn>;
  let onSuccessSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    primarySpy = vi.fn();
    fallbackSpy = vi.fn();
    onPrimaryErrorSpy = vi.fn();
    onFallbackErrorSpy = vi.fn();
    onSuccessSpy = vi.fn();
  });

  it('should return primary result when primary succeeds', async () => {
    const result = { id: 1, name: 'primary' };
    primarySpy.mockResolvedValue(result);

    const response = await executeWithFallback({
      primary: primarySpy,
      fallback: fallbackSpy,
      onSuccess: onSuccessSpy,
    });

    expect(response).toBe(result);
    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(onSuccessSpy).toHaveBeenCalledWith(result, 'primary');
  });

  it('should fallback when primary fails', async () => {
    const error = new Error('Primary failed');
    const fallbackResult = { id: 2, name: 'fallback' };

    primarySpy.mockRejectedValue(error);
    fallbackSpy.mockResolvedValue(fallbackResult);

    const response = await executeWithFallback({
      primary: primarySpy,
      fallback: fallbackSpy,
      onPrimaryError: onPrimaryErrorSpy,
      onSuccess: onSuccessSpy,
    });

    expect(response).toBe(fallbackResult);
    expect(onPrimaryErrorSpy).toHaveBeenCalledWith(error);
    expect(onSuccessSpy).toHaveBeenCalledWith(fallbackResult, 'fallback');
  });

  it('should return null when both fail', async () => {
    const primaryError = new Error('Primary failed');
    const fallbackError = new Error('Fallback failed');

    primarySpy.mockRejectedValue(primaryError);
    fallbackSpy.mockRejectedValue(fallbackError);

    const response = await executeWithFallback({
      primary: primarySpy,
      fallback: fallbackSpy,
      onPrimaryError: onPrimaryErrorSpy,
      onFallbackError: onFallbackErrorSpy,
    });

    expect(response).toBe(null);
    expect(onPrimaryErrorSpy).toHaveBeenCalledWith(primaryError);
    expect(onFallbackErrorSpy).toHaveBeenCalledWith(fallbackError);
    expect(onSuccessSpy).not.toHaveBeenCalled();
  });

  it('should not call onSuccess for null/falsy results', async () => {
    primarySpy.mockResolvedValue(null);

    const response = await executeWithFallback({
      primary: primarySpy,
      fallback: fallbackSpy,
      onSuccess: onSuccessSpy,
    });

    expect(response).toBe(null);
    expect(onSuccessSpy).not.toHaveBeenCalled();
    expect(fallbackSpy).not.toHaveBeenCalled();
  });
});
