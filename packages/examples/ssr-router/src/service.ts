/**
 * Service Configuration (Universal)
 *
 * Provides shared exports for both server and client:
 * - island wrapper for creating islands
 * - Service type for API typing
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
