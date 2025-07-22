interface FallbackOptions<T> {
  primary: () => Promise<T>;
  fallback: () => Promise<T>;
  onPrimaryError?: (error: unknown) => void;
  onFallbackError?: (error: unknown) => void;
  onSuccess?: (result: T, source: 'primary' | 'fallback') => Promise<void> | void;
}

/**
 * Executes a primary function and falls back to a secondary function if the primary fails.
 *
 * This function implements the Fallback Pattern - it attempts to execute the primary function first,
 * and if it throws an error, it will execute the fallback function instead. If either function
 * succeeds and returns a truthy value, the onSuccess callback will be called with the result.
 *
 * @template T The type of the result returned by both primary and fallback functions
 *
 * @param options Configuration object containing:
 * @param options.primary Function to execute first
 * @param options.fallback Function to execute if primary fails
 * @param options.onPrimaryError Optional callback called when primary function fails
 * @param options.onFallbackError Optional callback called when fallback function fails
 * @param options.onSuccess Optional callback called when either function succeeds with a truthy result
 *
 * @returns Promise that resolves to:
 *   - Result from primary function if it succeeds
 *   - Result from fallback function if primary fails but fallback succeeds
 *   - null if both functions fail or return falsy values
 *
 * @example
 * ```typescript
 * const command = await executeWithFallback({
 *   primary: () => handleSignRKHRefresh({ address, issuesRepository, tx }),
 *   fallback: () => handleSignRKHApplication({ address, applicationDetailsRepository, tx }),
 *   onPrimaryError: () => logger.info('Primary handler failed, trying fallback'),
 *   onFallbackError: (error) => logger.error('Both handlers failed', error),
 *   onSuccess: (command) => commandBus.send(command)
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Simple usage without error handlers
 * const result = await executeWithFallback({
 *   primary: () => fetchFromPrimaryAPI(),
 *   fallback: () => fetchFromBackupAPI()
 * });
 *
 * if (result) {
 *   console.log('Got result:', result);
 * } else {
 *   console.log('Both APIs failed');
 * }
 * ```
 */
export async function executeWithFallback<T>(options: FallbackOptions<T>): Promise<T | null> {
  const { primary, fallback, onPrimaryError, onFallbackError, onSuccess } = options;

  try {
    const result = await primary();
    if (result && onSuccess) {
      await onSuccess(result, 'primary');
    }
    return result;
  } catch (error) {
    onPrimaryError?.(error);

    try {
      const result = await fallback();
      if (result && onSuccess) {
        await onSuccess(result, 'fallback');
      }
      return result;
    } catch (fallbackError) {
      onFallbackError?.(fallbackError);
      return null;
    }
  }
}
