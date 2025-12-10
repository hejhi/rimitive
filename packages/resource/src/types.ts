/**
 * Resource state - discriminated union for async data states
 */
export type ResourceState<T> =
  | { status: 'pending' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: unknown };

/**
 * Load state - discriminated union for async load boundaries
 *
 * Similar to ResourceState but uses 'data' instead of 'value' for clarity
 * in the load() context where data is being fetched and rendered.
 */
export type LoadState<T> =
  | { status: 'pending' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

/**
 * Resource API - reactive async data fetching
 *
 * A resource tracks the state of an async operation and automatically
 * re-fetches when reactive dependencies change.
 */
export type Resource<T> = {
  /** Read current state (trackable as a reactive dependency) */
  (): ResourceState<T>;

  /** Current loading state */
  readonly loading: () => boolean;

  /** Current data (undefined if pending or error) */
  readonly data: () => T | undefined;

  /** Current error (undefined if pending or ready) */
  readonly error: () => unknown;

  /** Manually trigger a refetch */
  readonly refetch: () => void;

  /**
   * Dispose the resource - aborts in-flight requests and stops tracking.
   * Call this in onCleanup() for scope integration.
   */
  readonly dispose: () => void;
};

/**
 * Fetcher function type - receives AbortSignal for cancellation support.
 * Can contain reactive reads which will trigger refetch when they change.
 *
 * @example
 * ```ts
 * const products = resource((signal) =>
 *   fetch('/api/products', { signal }).then(r => r.json())
 * );
 * ```
 */
export type Fetcher<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Resource factory function type
 */
export type ResourceFactory = <T>(fetcher: Fetcher<T>) => Resource<T>;
