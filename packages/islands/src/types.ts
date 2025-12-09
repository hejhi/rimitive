/**
 * Core types for Islands Architecture
 *
 * Islands provide fine-grained hydration for server-side rendered applications.
 * Only interactive components ship JavaScript to the client.
 */

import type { RefSpec } from '@lattice/view/types';
import { HydrationMismatch } from '@lattice/ssr/client';

// Re-export HydrationMismatch from @lattice/ssr for convenience
export { HydrationMismatch };

// ============================================================================
// Context Types
// ============================================================================

/**
 * SSR Context - tracks islands during server-side rendering
 *
 * Uses AsyncLocalStorage for implicit context during render.
 * Each request gets its own isolated context.
 *
 * @example
 * ```typescript
 * import { createSSRContext, runWithSSRContext } from '@lattice/islands/ssr-context';
 *
 * const ctx = createSSRContext();
 * const html = runWithSSRContext(ctx, () => renderToString(app));
 * ```
 */
export type SSRContext = {
  /**
   * Islands discovered during rendering
   * Collected as components are rendered on the server
   */
  islands: IslandMetadata[];

  /**
   * Counter for generating unique island instance IDs
   * Increments for each island instantiation: "counter-0", "counter-1", etc.
   */
  islandCounter: number;
};

/**
 * Island metadata - describes a single island instance
 *
 * Emitted to client in container div with script tag marker:
 * <div id="counter-0">
 *   <!-- island content -->
 *   <script type="application/json" data-island="counter-0"></script>
 * </div>
 */
export type IslandMetadata = {
  /**
   * Unique instance ID for this island
   * Format: "{type}-{counter}" e.g., "counter-0", "form-1"
   */
  id: string;

  /**
   * Island type - matches the ID passed to island()
   * Used to look up component in client-side registry
   */
  type: string;

  /**
   * Props passed to island component
   * MUST be JSON-serializable (no functions, signals, or DOM nodes)
   */
  props: unknown;

  /**
   * Node status (STATUS_ELEMENT=1, STATUS_FRAGMENT=2)
   * Used by hydrator to determine container selection
   */
  status: number;
};

/**
 * Island component - function that receives props and returns a spec
 *
 * Islands are created with: island('counter', Component)
 * Components must accept JSON-serializable props only
 *
 * Note: This is a callable type. The actual functions will satisfy this.
 * The metadata symbol is added by the island() wrapper function.
 *
 * IMPORTANT: ISLAND_META and IslandMetaData must be exported from the same
 * entry points as IslandComponent to satisfy TypeScript's portable types
 * requirement (TS2742). See CLAUDE.md "Portable Types Rule" for details.
 */
export type IslandComponent<TProps = unknown> = {
  (props: TProps): RefSpec<unknown>;
  [ISLAND_META]?: IslandMetaData<TProps>;
};

/**
 * Island hydration strategy
 *
 * Customizes behavior when hydration fails (e.g., preserve form inputs, track analytics)
 *
 * @example
 * ```typescript
 * import { island, type IslandStrategy } from '@lattice/islands';
 * import type { IslandSvc } from '@lattice/islands';
 *
 * const formStrategy: IslandStrategy<{ value: string }, IslandSvc> = {
 *   onMismatch: (error, container, props, Component, mount) => {
 *     console.warn('Form hydration mismatch:', error.message);
 *     // Preserve user input instead of replacing
 *     return true;
 *   }
 * };
 *
 * const FormInput = island('form-input', formStrategy, (svc) => ({ value }) => {
 *   return svc.el('input').props({ value })();
 * });
 * ```
 */
export type IslandStrategy<TProps = unknown, TSvc = unknown> = {
  /**
   * Called when hydration fails
   */
  onMismatch?: (
    error: HydrationMismatch,
    containerEl: HTMLElement,
    props: TProps,
    Component: (svc: TSvc) => (props: TProps) => RefSpec<unknown>,
    mount: (spec: RefSpec<unknown>) => { element: unknown }
  ) => boolean | void;
};

/**
 * Symbol for storing island metadata on component functions
 * @internal
 */
export const ISLAND_META = Symbol.for('lattice.island');

/**
 * Island metadata stored on component functions (temporary, only for registry construction)
 * @internal
 */
export type IslandMetaData<TProps = unknown, TSvc = unknown> = {
  id: string;
  strategy?: IslandStrategy<TProps, TSvc>;
  component: (svc: TSvc) => (props: TProps) => RefSpec<unknown>;
};

/**
 * Island registry entry - stores component and metadata together
 * @internal
 */
export type IslandRegistryEntry<TProps = unknown, TSvc = unknown> = {
  component: (svc: TSvc) => (props: TProps) => RefSpec<unknown>;
  id: string;
  strategy?: IslandStrategy<TProps, TSvc>;
};

/**
 * Island node metadata for lazy registration during decoration
 *
 * Set on NodeRef during create(), used by decorator to register atomically.
 * This ensures only actually-rendered islands are registered.
 * @internal
 */
export type IslandNodeMeta = {
  /** Island type - matches the ID passed to island() */
  type: string;
  /** Props passed to island component (must be JSON-serializable) */
  props: unknown;
};

// ============================================================================
// Service Adapter Types
// ============================================================================

/**
 * Minimal type for service factory results
 *
 * Service factories return an object with at least `svc` containing
 * the composed service (signals + views + extensions).
 */
export type ServiceResult<TSvc = Record<string, unknown>> = {
  svc: TSvc;
};
