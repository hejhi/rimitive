/**
 * Service Configuration (Universal)
 *
 * Provides shared exports for both server and client:
 * - island wrapper for creating islands
 * - Service type for API typing
 * - router utilities for islands (universal useCurrentPath)
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
 * Service type - the API available to components
 *
 * Includes:
 * - Signals: signal, computed, effect, batch
 * - Views: el, map, match, show
 * - Router: navigate, currentPath
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

  // Router
  navigate: (path: string) => void;
  currentPath: ComputedFunction<string>;
};

/**
 * Module-level reference to the client router
 * Set by client.ts after creating the app
 */
let clientRouter: {
  currentPath: ComputedFunction<string>;
  navigate: (path: string) => void;
  useCurrentPath: (initialPath: string) => ComputedFunction<string>;
} | null = null;

/**
 * Set the client router reference (called from client.ts)
 */
export function setClientRouter(router: typeof clientRouter) {
  clientRouter = router;
}

/**
 * Universal router utilities for islands
 *
 * Works on both server and client:
 * - Server: useCurrentPath returns a mock computed
 * - Client: useCurrentPath/navigate delegate to the real router
 */
export const router = {
  /**
   * Get a reactive current path for islands
   * @param initialPath - The initial path (from props, set during SSR)
   */
  useCurrentPath(initialPath: string): ComputedFunction<string> {
    if (typeof window === 'undefined') {
      // Server: return a mock computed wrapping the initial path
      const getter = (() => initialPath) as ComputedFunction<string>;
      getter.peek = () => initialPath;
      return getter;
    }

    // Client: delegate to the real router
    if (!clientRouter) {
      throw new Error(
        'Router not initialized. Ensure client.ts calls setClientRouter().'
      );
    }
    return clientRouter.useCurrentPath(initialPath);
  },

  /**
   * Navigate to a new path (client-only)
   */
  navigate(path: string): void {
    if (typeof window === 'undefined') {
      // Server: no-op (navigation doesn't happen during SSR)
      return;
    }

    if (!clientRouter) {
      throw new Error(
        'Router not initialized. Ensure client.ts calls setClientRouter().'
      );
    }
    clientRouter.navigate(path);
  },
};
