/**
 * Service Configuration (Universal)
 *
 * Provides shared exports for both server and client:
 * - island wrapper for creating islands
 * - Service type for API typing
 * - AppContext type for island context
 */
export { island } from '@lattice/islands/island';

import type {
  SignalFunction,
  ComputedFunction,
} from '@lattice/signals/presets/core';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { ElFactory } from '@lattice/view/el';
import type { MapFactory } from '@lattice/view/map';
import type { MatchFactory } from '@lattice/view/match';
import type { ShowFactory } from '@lattice/view/show';

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
 * - Views: el, map, match, show
 * - Router: navigate, currentPath (injected by client.ts)
 */
export type Service = {
  // Signals
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;

  // Views
  el: ElFactory<DOMRendererConfig>['impl'];
  map: MapFactory<DOMRendererConfig['baseElement']>['impl'];
  match: MatchFactory<DOMRendererConfig['baseElement']>['impl'];
  show: ShowFactory<DOMRendererConfig['baseElement']>['impl'];

  // Router (injected by client.ts via createApiWithRouter)
  navigate: (path: string) => void;
  currentPath: ComputedFunction<string>;
};
