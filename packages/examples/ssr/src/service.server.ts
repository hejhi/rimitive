/**
 * SSR Server Service
 *
 * Server-side service with SSR utilities.
 * Uses the shared composition with server adapter.
 */
import { createDOMServerAdapter } from '@lattice/islands/adapters/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '@lattice/islands/ssr-context';
import { renderToString } from '@lattice/islands/deps/renderToString';
import type { RefSpec } from '@lattice/view/types';

import { createService } from './service.js';

// Create server adapter and service
const adapter = createDOMServerAdapter();
const svc = createService(adapter);

// Export primitives
export const { el, map, match, signal, computed, effect, batch } = svc;

// Mount helper
export const mount = <T>(spec: RefSpec<T>) => spec.create(svc);

// SSR render helper - combines mount + SSR context + renderToString
export const render = <T>(
  spec: RefSpec<T>
): { html: string; scripts: string } => {
  const ctx = createSSRContext();
  const html = runWithSSRContext(ctx, () => renderToString(mount(spec)));
  const scripts = getIslandScripts(ctx);
  return { html, scripts };
};

// Re-export island factory and Service type
export { island, type Service } from './service.js';
