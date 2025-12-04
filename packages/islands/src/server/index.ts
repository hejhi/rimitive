/**
 * Server Module
 *
 * Re-exports SSR primitives for server-side rendering with islands.
 */

export {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
export type { SSRContext } from '../types';

export { renderToString } from '../helpers/renderToString';

// Server adapter
export { createDOMServerAdapter } from '../adapters/dom-server';

// Unified islands app preset (server version)
export {
  createIslandsApp,
  type ServerApp,
  type ServerOptions,
  type IslandsServerService,
} from '../presets/core.server';
