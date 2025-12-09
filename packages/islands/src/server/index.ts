/**
 * Server Module
 *
 * Server-side utilities for islands architecture.
 */

// SSR context
export {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';

// Render to string
export { renderToString } from '../deps/renderToString';

// Server adapter
export { createDOMServerAdapter } from '../adapters/dom-server';

// Base island function (for creating typed wrappers)
export { island } from '../island';

// Types
export type { IslandComponent, IslandStrategy, GetContext } from '../types';

// Composable preset (for ssr-router style apps)
export {
  createIslandsApp,
  type ServerApp,
  type ServerOptions,
  type IslandsServerService,
} from '../presets/core.server';
