/**
 * Island Factory - Creates typed island functions
 *
 * Provides a factory pattern for creating islands with inferred types.
 * Instead of passing 3 generic arguments to every island:
 *
 * ```ts
 * // Before: verbose, repetitive
 * island<Props, Service, AppContext>('name', ...)
 * ```
 *
 * You create a typed factory once and use it everywhere:
 *
 * ```ts
 * // service.ts - create factory once
 * const app = createIslandsApp<AppContext>({ ... });
 * export const island = createIsland<typeof app>();
 *
 * // islands/MyIsland.ts - zero generics, props inferred
 * export const MyIsland = island('name', ({ el }, getContext) =>
 *   (props: { label: string }) => el('div')(props.label)
 * );
 * ```
 */

import { island as baseIsland } from './island';
import type { IslandComponent, IslandStrategy, GetContext } from './types';
import type { RefSpec } from '@lattice/view/types';

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Extract the service type from an islands app
 *
 * Works with both ClientApp and ServerApp from createIslandsApp
 */
type ServiceOf<TApp> = TApp extends { service: infer S } ? S : never;

/**
 * Islands app shape - matches both ClientApp and ServerApp
 */
interface IslandsApp {
  service: Record<string, unknown>;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Island factory function - returned by createIsland
 *
 * This is the function you use to define islands. Props are inferred
 * from the inline type annotation on the factory's inner function.
 */
export interface IslandFactory<TService, TContext> {
  /**
   * Define an island component
   *
   * @param id - Unique identifier for this island type
   * @param factory - Component factory receiving (api, getContext) => (props) => RefSpec
   * @returns Island component function
   *
   * @example
   * ```ts
   * const Counter = island('counter', ({ el, signal }, getContext) =>
   *   (props: { initial: number }) => {
   *     const count = signal(props.initial);
   *     return el('button', { onclick: () => count(count() + 1) })(
   *       () => `Count: ${count()}`
   *     );
   *   }
   * );
   * ```
   */
  <TProps>(
    id: string,
    factory: (
      api: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;

  /**
   * Define an island with custom hydration strategy
   *
   * @param id - Unique identifier for this island type
   * @param strategy - Custom hydration strategy (e.g., onMismatch handler)
   * @param factory - Component factory
   * @returns Island component function
   */
  <TProps>(
    id: string,
    strategy: IslandStrategy<TProps, TService, TContext>,
    factory: (
      api: TService,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>
  ): IslandComponent<TProps>;
}

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Create a typed island factory
 *
 * Returns an `island` function with Service and Context types baked in.
 * Props are inferred from the factory function's parameter annotation.
 *
 * Two usage patterns are supported:
 *
 * 1. **From app type** - infer Service from createIslandsApp return type:
 * ```ts
 * const app = createIslandsApp<AppContext>({ ... });
 * export const island = createIsland<typeof app, AppContext>();
 * ```
 *
 * 2. **Explicit types** - specify Service and Context directly:
 * ```ts
 * export const island = createIsland<Service, AppContext>();
 * ```
 *
 * @typeParam TServiceOrApp - Either the Service type directly, or the app type (typeof app)
 * @typeParam TContext - The context type available via getContext()
 * @returns Typed island factory function
 *
 * @example
 * ```ts
 * // In service.ts - explicit types (recommended for universal code)
 * import { createIsland } from '@lattice/islands/factory';
 *
 * interface AppContext { pathname: string; }
 * type Service = { el: ...; signal: ...; computed: ...; };
 *
 * export const island = createIsland<Service, AppContext>();
 *
 * // In islands/Counter.ts
 * import { island } from '../service.js';
 *
 * export const Counter = island('counter', ({ el, signal }) =>
 *   (props: { initial: number }) => {
 *     const count = signal(props.initial);
 *     return el('div')(count);
 *   }
 * );
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
          api: TService,
          getContext: GetContext<TContext>
        ) => (props: TProps) => RefSpec<unknown>),
    maybeFactory?: (
      api: TService,
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
        api: TService,
        getContext: GetContext<TContext>
      ) => (props: TProps) => RefSpec<unknown>
    );
  }

  return island as IslandFactory<TService, TContext>;
}
