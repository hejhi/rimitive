/**
 * Core types for Islands Architecture
 *
 * Islands provide fine-grained hydration for server-side rendered applications.
 * Only interactive components ship JavaScript to the client.
 */

import type { SealedSpec } from '@lattice/view/types';
import { HydrationMismatch } from '@lattice/view/renderers/hydrating-dom';

// Re-export HydrationMismatch for convenience
export { HydrationMismatch };

/**
 * SSR Context - tracks islands during server-side rendering
 *
 * Uses AsyncLocalStorage for implicit context during render.
 * Each request gets its own isolated context.
 */
export interface SSRContext {
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
}

/**
 * Island metadata - describes a single island instance
 *
 * Emitted to client as data attributes for hydration:
 * <div id="counter-0" data-island-id="counter-0" data-island-type="counter" data-island-props='{"count":5}'>
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
  (props: TProps): SealedSpec<unknown>;
  [ISLAND_META]?: IslandMetaData<TProps>;
}

/**
 * Island hydration strategy
 *
 * Customizes behavior when hydration fails (e.g., preserve form inputs, track analytics)
 */
export interface IslandStrategy<TProps = unknown> {
  /**
   * Called when hydration fails
   *
   * @param error - The hydration mismatch error
   * @param containerEl - The island container element
   * @param props - Props for this island instance
   * @param Component - The island component function
   * @param mount - Mount function for client-side rendering
   * @returns false to skip default fallback, undefined to proceed with fallback
   * @throws Error to propagate error up
   */
  onMismatch?: (
    error: HydrationMismatch,
    containerEl: HTMLElement,
    props: TProps,
    Component: IslandComponent<TProps>,
    mount: (spec: SealedSpec<unknown>) => { element: unknown }
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
export interface IslandMetaData<TProps = unknown> {
  id: string;
  strategy?: IslandStrategy<TProps>;
  component: (props: TProps) => SealedSpec<unknown>;
}

/**
 * Island registry entry - stores component and metadata together
 * @internal
 */
export interface IslandRegistryEntry<TProps = unknown> {
  component: IslandComponent<TProps>;
  id: string;
  strategy?: IslandStrategy<TProps>;
}
