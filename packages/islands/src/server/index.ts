/**
 * Server Module
 *
 * Server-side rendering preset for islands architecture.
 *
 * @example
 * ```ts
 * import { createIslandsServerApp } from '@lattice/islands/server';
 *
 * const { el, signal, render } = createIslandsServerApp();
 *
 * const App = () => el('div')(
 *   el('h1')('Hello SSR'),
 *   Counter({ initialCount: 0 })
 * );
 *
 * const { html, scripts } = render(App());
 * ```
 */

// Batteries-included preset
export {
  createIslandsServerApp,
  type IslandsServerApp,
  type IslandsServerOptions,
  type IslandSvc,
} from '../presets/islands.server';

export { renderToString } from '../helpers/renderToString';

// Pre-configured island factory for the simple case (no custom context)
// For custom context, use: createIsland<IslandSvc, MyContext>() from '@lattice/islands/factory'
export { island } from './island';

// Advanced: composable preset for custom wiring (e.g., routing integration)
export {
  createIslandsApp,
  type ServerApp,
  type ServerOptions,
  type IslandsServerService,
} from '../presets/core.server';

// Advanced: server adapter for custom composition
export { createDOMServerAdapter } from '../adapters/dom-server';
