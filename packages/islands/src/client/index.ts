/**
 * Client Module
 *
 * Client-side hydration preset for islands architecture.
 *
 * @example
 * ```ts
 * import { createIslandsClientApp } from '@lattice/islands/client';
 * import { Counter } from './islands/Counter';
 *
 * const { hydrate } = createIslandsClientApp();
 *
 * hydrate(Counter);
 * ```
 */

// Batteries-included preset
export {
  createIslandsClientApp,
  type IslandsClientApp,
  type IslandSvc,
} from '../presets/islands.client';

// Pre-configured island factory for the simple case (no custom context)
// For custom context, use: createIsland<IslandSvc, MyContext>() from '@lattice/islands/factory'
export { island } from './island';

// Advanced: composable preset for custom wiring (e.g., routing integration)
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
  type IslandComponent,
  type SignalsSvc,
  type ViewsSvc,
  type HybridAdapter,
} from '../presets/core.client';

// Advanced: adapters for custom composition
export { createDOMHydrationAdapter } from '../adapters/dom-hydration';
export { createIslandsAdapter } from '../adapters/islands';
