/**
 * Island Factory - Browser version
 *
 * Browser-safe version that imports from island.browser.
 */

import { island as baseIsland } from './island.browser';
import type { IslandComponent, IslandStrategy, GetContext } from './types';
import type { RefSpec } from '@lattice/view/types';

/**
 * Extract the service type from an islands app
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
 */
export type IslandFactory<TService, TContext> = {
  <TProps>(
    id: string,
    factory: (
      api: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;

  <TProps>(
    id: string,
    strategy: IslandStrategy<TProps, TService, TContext>,
    factory: (
      api: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;
};

/**
 * Create a typed island factory (browser version)
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

  function island<TProps>(
    id: string,
    strategyOrFactory:
      | IslandStrategy<TProps, TService, TContext>
      | ((
          api: TService,
          getContext: GetContext<TContext>
        ) => (props: TProps) => RefSpec<unknown>),
    maybeFactory?: (
      api: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps> {
    if (maybeFactory) {
      return baseIsland<TProps, TService, TContext>(
        id,
        strategyOrFactory as IslandStrategy<TProps, TService, TContext>,
        maybeFactory
      );
    }
    return baseIsland<TProps, TService, TContext>(
      id,
      strategyOrFactory as (
        api: TService,
        getContext: GetContext<TContext>
      ) => (props: TProps) => RefSpec<unknown>
    );
  }

  return island as IslandFactory<TService, TContext>;
}
