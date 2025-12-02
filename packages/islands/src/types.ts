/**
 * Core types for Islands Architecture
 *
 * Islands provide fine-grained hydration for server-side rendered applications.
 * Only interactive components ship JavaScript to the client.
 */

import type { RefSpec } from '@lattice/view/types';
import { HydrationMismatch } from './renderers/dom-hydration';

// Re-export HydrationMismatch for convenience
export { HydrationMismatch };

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context getter type - passed to island factories as second argument
 *
 * Islands receive a getter function that returns user-defined context.
 * On server: static, from SSR setup
 * On client: reactive, called on init and navigation (popstate)
 *
 * If no context is configured, the getter returns undefined.
 *
 * @example
 * ```ts
 * const MyIsland = island('my-island', (api, getContext) => {
 *   const ctx = getContext(); // User-defined shape or undefined
 *   return (props) => api.el('div')(props.label);
 * });
 * ```
 */
export type GetContext<TContext = unknown> = () => TContext | undefined;

/**
 * SSR Context - tracks islands during server-side rendering
 *
 * Uses AsyncLocalStorage for implicit context during render.
 * Each request gets its own isolated context.
 */
export interface SSRContext<TContext = unknown> {
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

  /**
   * Context getter for the current SSR request
   * Set by the request handler, available to islands
   */
  getContext?: GetContext<TContext>;
}

/**
 * Island metadata - describes a single island instance
 *
 * Emitted to client in container div with script tag marker:
 * <div id="counter-0">
 *   <!-- island content -->
 *   <script type="application/json" data-island="counter-0"></script>
 * </div>
 */
export interface IslandMetadata {
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
}

/**
 * Island component - function that receives props and returns a spec
 *
 * Islands are created with: island('counter', Component)
 * Components must accept JSON-serializable props only
 *
 * Note: This is a callable interface. The actual functions will satisfy this.
 * The metadata symbol is added by the island() wrapper function.
 */
export interface IslandComponent<TProps = unknown> {
  (props: TProps): RefSpec<unknown>;
  [ISLAND_META]?: IslandMetaData<TProps>;
}

/**
 * Island hydration strategy
 *
 * Customizes behavior when hydration fails (e.g., preserve form inputs, track analytics)
 */
export interface IslandStrategy<TProps = unknown, TApi = unknown, TContext = unknown> {
  /**
   * Called when hydration fails
   *
   * @param error - The hydration mismatch error
   * @param containerEl - The island container element
   * @param props - Props for this island instance
   * @param Component - The island component factory function
   * @param mount - Mount function for client-side rendering
   * @returns false to skip default fallback, undefined to proceed with fallback
   * @throws Error to propagate error up
   */
  onMismatch?: (
    error: HydrationMismatch,
    containerEl: HTMLElement,
    props: TProps,
    Component: (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>,
    mount: (spec: RefSpec<unknown>) => { element: unknown }
  ) => boolean | void;
}

/**
 * Symbol for storing island metadata on component functions
 * @internal
 */
export const ISLAND_META = Symbol.for('lattice.island');

/**
 * Island metadata stored on component functions (temporary, only for registry construction)
 * @internal
 */
export interface IslandMetaData<TProps = unknown, TApi = unknown, TContext = unknown> {
  id: string;
  strategy?: IslandStrategy<TProps, TApi, TContext>;
  component: (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>;
}

/**
 * Island registry entry - stores component and metadata together
 * @internal
 */
export interface IslandRegistryEntry<TProps = unknown, TApi = unknown, TContext = unknown> {
  component: (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>;
  id: string;
  strategy?: IslandStrategy<TProps, TApi, TContext>;
}

/**
 * Island node metadata for lazy registration during decoration
 *
 * Set on NodeRef during create(), used by decorator to register atomically.
 * This ensures only actually-rendered islands are registered.
 * @internal
 */
export interface IslandNodeMeta {
  /** Island type - matches the ID passed to island() */
  type: string;
  /** Props passed to island component (must be JSON-serializable) */
  props: unknown;
}

// ============================================================================
// Service Adapter Types
// ============================================================================

/**
 * Minimal interface for service factory results
 *
 * Service factories return an object with at least `svc` containing
 * the composed service (signals + views + extensions).
 *
 * Similar to ReactiveAdapter in @lattice/view, this defines the protocol
 * without coupling to specific implementations.
 */
export interface ServiceResult<TSvc = Record<string, unknown>> {
  svc: TSvc;
}
