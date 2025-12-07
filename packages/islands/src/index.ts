/**
 * @lattice/islands - Islands Architecture for Server-Side Rendering
 *
 * Provides fine-grained hydration for Lattice applications.
 * Only interactive components ("islands") ship JavaScript to the client.
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Define islands | `import { island } from '@lattice/islands'` |
 * | Server rendering | `import { createIslandsServerApp } from '@lattice/islands/server'` |
 * | Client hydration | `import { createIslandsClientApp } from '@lattice/islands/client'` |
 * | Typed islands | `import { createIsland, type IslandSvc } from '@lattice/islands'` |
 *
 * ## Quick Start
 *
 * ```ts
 * // 1. Define an island
 * import { island } from '@lattice/islands';
 *
 * export const Counter = island('counter', (svc, getContext) => ({ count }) => {
 *   const { el, signal } = svc;
 *   const value = signal(count);
 *   return el('button').props({ onclick: () => value(value() + 1) })(value);
 * });
 *
 * // 2. Server: render to HTML
 * import { createIslandsServerApp } from '@lattice/islands/server';
 * const { el, render } = createIslandsServerApp();
 * const { html, scripts } = render(el('div')(Counter({ count: 0 })));
 *
 * // 3. Client: hydrate
 * import { createIslandsClientApp } from '@lattice/islands/client';
 * const { hydrate } = createIslandsClientApp();
 * hydrate(Counter);
 * ```
 */

// =============================================================================
// Primary API - Island Definition
// =============================================================================

export { island } from './island';
export { createIsland, type IslandFactory } from './factory';

// =============================================================================
// Core Types
// =============================================================================

export type {
  IslandComponent,
  IslandStrategy,
  GetContext,
  IslandMetaData,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';

// Re-export IslandSvc for convenience (the type islands receive)
export type { IslandSvc } from './presets/islands.server';

// =============================================================================
// Advanced: Composable Presets
// =============================================================================

export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/core.client';
