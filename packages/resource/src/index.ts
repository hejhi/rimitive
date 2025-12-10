/**
 * @lattice/resource - Async data fetching with reactive dependency tracking
 *
 * ## Quick Start
 * ```typescript
 * import { ResourceModule, createLoadModule } from '@lattice/resource';
 * import { compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const modules = compose(
 *   SignalModule,
 *   ComputedModule,
 *   EffectModule,
 *   ResourceModule,
 *   createLoadModule(adapter)
 * );
 * const { resource, load } = modules();
 *
 * // Reactive resource with auto-refetch
 * const products = resource(() =>
 *   fetch('/api/products').then(r => r.json())
 * );
 *
 * // Async boundary with fetcher/renderer pattern
 * load(
 *   () => fetchStats(),
 *   (state) => {
 *     switch (state.status) {
 *       case 'pending': return el('div')('Loading...');
 *       case 'error': return el('div')(`Error: ${state.error}`);
 *       case 'ready': return StatsContent(state.data);
 *     }
 *   }
 * );
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Module composition | `import { ResourceModule, createLoadModule } from '@lattice/resource'` |
 * | Adapter helpers | `import { withAsyncSupport } from '@lattice/resource'` |
 * | Types only | `import type { Resource, ResourceState, LoadState } from '@lattice/resource'` |
 */

// =============================================================================
// Primary API - Modules for composition
// =============================================================================

export { ResourceModule } from './resource';
export { createLoadModule } from './load';

// =============================================================================
// Async Boundaries - load() helpers
// =============================================================================

export {
  ASYNC_FRAGMENT,
  createLoadFactory,
  isAsyncFragment,
  getAsyncMeta,
  resolveAsyncFragment,
  collectAsyncFragments,
  triggerAsyncFragment,
  triggerAsyncFragments,
} from './load';
export type {
  LoadFactory,
  LoadService,
  LoadOpts,
  LoadOptions,
  AsyncFragment,
  AsyncMeta,
} from './load';

// =============================================================================
// Adapter Helpers - Wrap adapters with async fragment support
// =============================================================================

export {
  withAsyncSupport,
  withHydrationData,
  createWindowHydrationStore,
  clearWindowHydrationData,
} from './adapters';
export type { HydrationDataStore } from './adapters';

// =============================================================================
// Core Types - For typing behaviors and components
// =============================================================================

export type {
  Resource,
  ResourceState,
  Fetcher,
  ResourceFactory,
  LoadState,
} from './types';
