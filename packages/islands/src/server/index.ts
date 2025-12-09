/**
 * Server Module
 *
 * Server-side utilities for islands architecture.
 */

// Island-specific SSR context
export {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';

// Re-export renderToString from @lattice/ssr for convenience
export { renderToString } from '@lattice/ssr/server';

// Island-aware server adapter (adds script tags for islands)
export { createDOMServerAdapter } from '../adapters/dom-server';

// Base island function (for creating typed wrappers)
export { island } from '../island';

// Types
export type { IslandComponent, IslandStrategy } from '../types';
