/**
 * @lattice/resource - Async data fetching with reactive dependency tracking
 *
 * ## Quick Start
 * ```typescript
 * import { ResourceModule, LoadModule } from '@lattice/resource';
 * import { compose, instantiate } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 *
 * const modules = compose(SignalModule, ComputedModule, EffectModule, ResourceModule, LoadModule);
 * const { resource, load } = instantiate(modules);
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
 * | Module composition | `import { ResourceModule, LoadModule } from '@lattice/resource'` |
 * | Adapter helpers | `import { withAsyncSupport } from '@lattice/resource'` |
 * | Types only | `import type { Resource, ResourceState, LoadState } from '@lattice/resource'` |
 */

// =============================================================================
// Primary API - Modules for composition
// =============================================================================

export { ResourceModule } from './resource';
export { LoadModule, createLoadModule } from './load';

// =============================================================================
// Async Boundaries - load() helpers
// =============================================================================

export {
  createLoadFactory,
  isAsyncFragment,
  resolveAsyncFragment,
  collectAsyncFragments,
  triggerAsyncFragment,
  triggerAsyncFragments,
} from './load';
export type {
  LoadFactory,
  LoadOptions,
  AsyncFragmentRef,
  AsyncFragmentMeta,
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
