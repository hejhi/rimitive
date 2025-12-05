/**
 * Island Factory - Creates typed island functions
 *
 * Provides a factory pattern for creating islands with inferred types.
 * Instead of passing 3 generic arguments to every island:
 */

import { island as baseIsland } from './island';
import type {
  IslandComponent,
  IslandStrategy,
  GetContext,
  IslandMetaData,
} from './types';
import { ISLAND_META } from './types';
import type { RefSpec } from '@lattice/view/types';

// Re-export types that IslandComponent references so consumers can name them
export type { IslandComponent, IslandMetaData };
export { ISLAND_META };

/**
 * Extract the service type from an islands app
 *
 * Works with both ClientApp and ServerApp from createIslandsApp
 */
type ServiceOf<TApp> = TApp extends { service: infer S } ? S : never;

/**
 * Islands app shape - matches both ClientApp and ServerApp
 */
type IslandsApp = {
  service: Record<string, unknown>;
};

/**
 * Island factory function - returned by createIsland
 *
 * This is the function you use to define islands. Props are inferred
 * from the inline type annotation on the factory's inner function.
 */
export type IslandFactory<TService, TContext> = {
  /**
   * Define an island component
   */
  <TProps>(
    id: string,
    factory: (
      svc: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;

  /**
   * Define an island with custom hydration strategy
   */
  <TProps>(
    id: string,
    strategy: IslandStrategy<TProps, TService, TContext>,
    factory: (
      svc: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;
};

/**
 * Create a typed island factory
 *
 * Returns an `island` function with Service and Context types baked in.
 * Props are inferred from the factory function's parameter annotation.
 *
 * @example
 * ```typescript
 * import { createIsland } from '@lattice/islands';
 * import type { IslandSvc } from '@lattice/islands';
 *
 * const island = createIsland<IslandSvc>();
 *
 * export const Counter = island('counter', (svc) => ({ initialCount }: { initialCount: number }) => {
 *   const count = svc.signal(initialCount);
 *   return svc.el('button').props({ onclick: () => count(count() + 1) })(count);
 * });
 * ```
 */
export function createIsland<
  TServiceOrApp,
  TContext = unknown,
>(): IslandFactory<
  TServiceOrApp extends IslandsApp ? ServiceOf<TServiceOrApp> : TServiceOrApp,
  TContext
> {
  type TService = TServiceOrApp extends IslandsApp
    ? ServiceOf<TServiceOrApp>
    : TServiceOrApp;

  // Return a function that delegates to baseIsland with types baked in
  function island<TProps>(
    id: string,
    strategyOrFactory:
      | IslandStrategy<TProps, TService, TContext>
      | ((
          svc: TService,
          getContext: GetContext<TContext>
        ) => (props: TProps) => RefSpec<unknown>),
    maybeFactory?: (
      svc: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps> {
    if (maybeFactory) {
      // Called with strategy
      return baseIsland<TProps, TService, TContext>(
        id,
        strategyOrFactory as IslandStrategy<TProps, TService, TContext>,
        maybeFactory
      );
    }
    // Called without strategy
    return baseIsland<TProps, TService, TContext>(
      id,
      strategyOrFactory as (
        svc: TService,
        getContext: GetContext<TContext>
      ) => (props: TProps) => RefSpec<unknown>
    );
  }

  return island as IslandFactory<TService, TContext>;
}
