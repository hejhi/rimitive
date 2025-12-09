/**
 * SSR Server Service - Module Composition Pattern
 *
 * Server-only service that composes signals and view modules with SSR utilities.
 * This file uses Node.js APIs (AsyncLocalStorage) and should only be imported
 * on the server side.
 */
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createDOMServerAdapter } from '@lattice/islands/adapters/dom-server';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import type { RefSpec } from '@lattice/view/types';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '@lattice/islands/ssr-context';
import { renderToString } from '@lattice/islands/deps/renderToString';

// Re-export island factory for server-side island registration
export { island } from '@lattice/islands/server';

// Create server adapter (virtual DOM for string serialization)
const adapter = createDOMServerAdapter();

// Compose modules
const use = compose(
  // Signals
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  // View (adapter-bound)
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter)
);

// Get the composed service
const svc = use();

// Export primitives
export const { el, map, match, signal, computed, effect, batch } = svc;

// Mount helper - must pass svc for islands to receive their dependencies
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

// Export service type for typing
export type Service = ReturnType<typeof use>;
