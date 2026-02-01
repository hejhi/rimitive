import type { Readable, FlushStrategy } from '@rimitive/signals';

/**
 * A flush strategy factory - takes a callback and returns a FlushStrategy.
 * Examples: `mt`, `raf`, `debounce(300, ...)`.
 */
export type FlushStrategyFactory = (
  run: () => void | (() => void)
) => FlushStrategy;

/**
 * Resource state - discriminated union for async data states
 */
export type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: unknown };

/**
 * Options for resource creation
 */
export type ResourceOptions = {
  /**
   * Whether the resource is enabled. When false, the resource stays in 'idle'
   * status and doesn't fetch. When it becomes true, triggers fetch.
   * Accepts a boolean or a Readable<boolean> for reactive enabling/disabling.
   * @default true
   */
  enabled?: boolean | Readable<boolean>;

  /**
   * Flush strategy for the internal effect. Controls when re-fetches execute.
   * Pass a strategy factory like `mt`, `raf`, or `debounce(ms, ...)`.
   *
   * On the server, async strategies (mt, raf, etc.) are no-ops, making the
   * resource effectively client-only - useful for SSR apps.
   *
   * @example
   * ```ts
   * // Client-only resource (no-ops on server)
   * resource((s) => fetch('/api', { signal: s }), { flush: mt });
   *
   * // Debounced refetch
   * resource((s) => fetch('/api?q=' + query(), { signal: s }), {
   *   flush: (run) => debounce(300, run)
   * });
   * ```
   */
  flush?: FlushStrategyFactory;
};

/**
 * Resource API - reactive async data fetching
 *
 * A resource tracks the state of an async operation and automatically
 * re-fetches when reactive dependencies change.
 */
export type Resource<T> = {
  /** Read current state (trackable as a reactive dependency) */
  (): ResourceState<T>;

  /** Whether the resource is idle (enabled=false, hasn't fetched) */
  readonly idle: () => boolean;

  /** Current loading state */
  readonly loading: () => boolean;

  /** Current data (undefined if idle, pending, or error) */
  readonly data: () => T | undefined;

  /** Current error (undefined if idle, pending, or ready) */
  readonly error: () => unknown;

  /** Manually trigger a refetch */
  readonly refetch: () => void;

  /**
   * Dispose the resource - aborts in-flight requests and stops tracking.
   * Return this from a `.ref()` callback for automatic cleanup on unmount.
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
export type ResourceFactory = <T>(
  fetcher: Fetcher<T>,
  options?: ResourceOptions
) => Resource<T>;
