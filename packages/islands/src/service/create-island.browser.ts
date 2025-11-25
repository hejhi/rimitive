/**
 * Typed Island Factory - Browser Version
 *
 * Creates a typed island function bound to a service descriptor.
 * Uses the browser version of island that doesn't import ssr-context.
 */

import type { RefSpec } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from '../types';
import { island as baseIsland } from '../island.browser';
import type { ServiceDescriptor } from './types';

/**
 * Create a typed island factory bound to a service
 *
 * Returns an `island` function that infers the API type from the service descriptor.
 * This eliminates the need for manual type annotations on island components.
 */
export function createIsland<TService>(_service: ServiceDescriptor<TService>): {
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
