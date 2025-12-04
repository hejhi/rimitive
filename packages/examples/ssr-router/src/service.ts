/**
 * Service Configuration (Universal)
 *
 * Provides shared exports for both server and client:
 * - island factory for creating typed islands
 * - Service type (derived from preset)
 * - AppContext type for island context
 */
import { createIsland } from '@lattice/islands/factory';
import type { SSRService } from './preset.js';

/**
 * App context - user-defined context available to islands
 *
 * Passed via getContext() to island factories.
 * On server: provided to createSSRContext
 * On client: built from window.location on init and navigation
 */
export type AppContext = {
  /** URL pathname (e.g., "/products/123") */
  pathname: string;
  /** URL search string (e.g., "?sort=price") */
  search: string;
};

/**
 * Build AppContext from a URL
 */
export function buildAppContext(url: URL | string): AppContext {
  const urlObj =
    typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  return {
    pathname: urlObj.pathname,
    search: urlObj.search,
  };
}

/**
 * Service type - derived from the SSR preset factory
 */
export type Service = SSRService;

/**
 * Typed island factory
 *
 * Creates islands with Service and AppContext types baked in.
 * Props are inferred from the factory function - no generics needed!
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
 */
export function withSvc<TArgs extends unknown[], TResult>(
  factory: (svc: Service, ...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  return (...args) => factory(getService(), ...args);
}
