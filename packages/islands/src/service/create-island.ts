/**
 * Typed Island Factory
 *
 * Creates a typed island function bound to a service descriptor.
 * The returned island function infers types from the service.
 */

import type { RefSpec } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from '../types';
import { island as baseIsland } from '../island';
import type { ServiceDescriptor } from './define-service';

/**
 * Create a typed island factory bound to a service
 *
 * Returns an `island` function that infers the API type from the service descriptor.
 * This eliminates the need for manual type annotations on island components.
 *
 * @param service - Service descriptor from defineService()
 * @returns Typed island factory function
 *
 * @example
 * ```ts
 * // service.ts
 * export const service = defineService((base) => ({
 *   ...base,
 *   analytics: createAnalytics(),
 * }));
 * export const island = createIsland(service);
 *
 * // islands/Counter.ts
 * import { island } from '../service.js';
 *
 * export const Counter = island('Counter', ({ el, signal, analytics }) => (props) => {
 *   // el, signal, analytics all typed correctly!
 *   analytics.track('counter_view');
 *   const count = signal(props.initialCount);
 *   return el('button', { onclick: () => count(count() + 1) })(count);
 * });
 * ```
 */
export function createIsland<TService>(
  _service: ServiceDescriptor<TService>
): {
  /**
   * Mark a component as an island
   */
  <TProps>(
    id: string,
    factory: (api: TService) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;

  /**
   * Mark a component as an island with custom hydration strategy
   */
  <TProps>(
    id: string,
    strategy: IslandStrategy<TProps>,
    factory: (api: TService) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;
} {
  // Return the base island function - it already handles the deferred pattern
  // The typing is what changes - TService is inferred from the service descriptor
  return baseIsland as ReturnType<typeof createIsland<TService>>;
}
