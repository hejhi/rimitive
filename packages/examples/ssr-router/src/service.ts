/**
 * Service Configuration (Universal)
 *
 * Provides shared exports for both server and client:
 * - island factory for creating typed islands
 * - Service type for API typing
 * - AppContext type for island context
 */
import { createIsland } from '@lattice/islands/factory';
import type {
  SignalFunction,
  ComputedFunction,
} from '@lattice/signals/presets/core';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { ElFactory } from '@lattice/view/el';
import type { MapFactory } from '@lattice/view/map';
import type { MatchFactory } from '@lattice/view/match';

/**
 * App context - user-defined context available to islands
 *
 * Passed via getContext() to island factories.
 * On server: provided to createSSRContext
 * On client: built from window.location on init and navigation
 */
export interface AppContext {
  /** URL pathname (e.g., "/products/123") */
  pathname: string;
  /** URL search string (e.g., "?sort=price") */
  search: string;
}

/**
 * Build AppContext from a URL
 */
export function buildAppContext(url: URL | string): AppContext {
  const urlObj = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  return {
    pathname: urlObj.pathname,
    search: urlObj.search,
  };
}

/**
 * Service type - the API available to components
 *
 * Includes:
 * - Signals: signal, computed, effect, batch
 * - Views: el, map, match
 * - Router: navigate, currentPath (injected by client.ts)
 */
export type Service = {
  // Signals
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;

  // Views
  el: ElFactory<DOMAdapterConfig>['impl'];
  map: MapFactory<DOMAdapterConfig['baseElement']>['impl'];
  match: MatchFactory<DOMAdapterConfig['baseElement']>['impl'];

  // Router (injected by client.ts via createApiWithRouter)
  navigate: (path: string) => void;
  currentPath: ComputedFunction<string>;
};

/**
 * Typed island factory
 *
 * Creates islands with Service and AppContext types baked in.
 * Props are inferred from the factory function - no generics needed!
 *
 * @example
 * ```ts
 * export const Counter = island('counter', ({ el, signal }) =>
 *   (props: { initial: number }) => {
 *     const count = signal(props.initial);
 *     return el('div')(count);
 *   }
 * );
 * ```
 */
export const island = createIsland<Service, AppContext>();

/**
 * Service getter - set by server (AsyncLocalStorage) or client (singleton)
 */
let getService: () => Service;

/**
 * Configure the service lookup
 *
 * Called once at startup:
 * - Server: passes AsyncLocalStorage-based getter
 * - Client: passes singleton getter
 */
export function setServiceGetter(getter: () => Service): void {
  getService = getter;
}

/**
 * SSR middleware - injects service as first parameter
 *
 * Generic middleware that prepends the current service to any function call.
 * Works with connect(), standalone components, or any other pattern.
 *
 * @example
 * ```ts
 * // With connect (route context)
 * export const AppLayout = connect(api(
 *   (svc, { children }) => () => {
 *     const { el } = svc;
 *     return el('div')(...(children || []));
 *   }
 * ));
 *
 * // Standalone component
 * export const About = api(
 *   (svc) => () => {
 *     const { el } = svc;
 *     return el('div')('About');
 *   }
 * );
 * ```
 */
export function api<TArgs extends unknown[], TResult>(
  factory: (svc: Service, ...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  return (...args) => factory(getService(), ...args);
}
