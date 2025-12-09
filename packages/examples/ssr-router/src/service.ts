/**
 * SSR Router Service - Shared Composition
 *
 * Single source of truth for service composition.
 * Both server and client use this with their respective adapters.
 */
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { OnModule } from '@lattice/view/deps/addEventListener';
import { island as baseIsland, type IslandComponent } from '@lattice/islands';
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { RefSpec } from '@lattice/view/types';

/**
 * App context - user-defined context available to islands
 *
 * Passed via getContext() to island factories.
 * On server: derived from request URL
 * On client: derived from window.location
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
 * Create a base service with the given adapter
 */
export function createBaseService(adapter: Adapter<DOMAdapterConfig>) {
  const use = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(adapter),
    createMapModule(adapter),
    createMatchModule(adapter),
    OnModule
  );
  return use();
}

/**
 * Base service type - from composition (without router)
 */
export type BaseService = ReturnType<typeof createBaseService>;

/**
 * Full service type - base + router methods
 */
export type Service = BaseService & {
  navigate: (path: string) => void;
  currentPath: () => string;
};

/**
 * Island factory - typed wrapper that fixes Service and AppContext types
 */
export function island<TProps>(
  id: string,
  factory: (
    svc: Service,
    getContext: () => AppContext | undefined
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  return baseIsland(id, factory);
}

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
