/**
 * @lattice/resource - Reactive async data fetching
 *
 * Provides the `resource()` primitive for reactive async data fetching
 * with automatic dependency tracking and cancellation.
 *
 * ## Quick Start
 * ```typescript
 * import { ResourceModule } from '@lattice/resource';
 * import { compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 *
 * const { resource } = compose(
 *   SignalModule,
 *   ComputedModule,
 *   EffectModule,
 *   ResourceModule
 * )();
 *
 * // Reactive resource with auto-refetch
 * const products = resource((signal) =>
 *   fetch('/api/products', { signal }).then(r => r.json())
 * );
 *
 * // Read state reactively
 * products();        // { status: 'pending' | 'ready' | 'error', ... }
 * products.loading(); // boolean
 * products.data();    // T | undefined
 * products.error();   // unknown | undefined
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Module composition | `import { ResourceModule } from '@lattice/resource'` |
 * | Factory (advanced) | `import { createResourceFactory } from '@lattice/resource'` |
 * | Types only | `import type { Resource, ResourceState } from '@lattice/resource'` |
 *
 * ## Related
 *
 * For async loading boundaries with UI rendering, see `@lattice/view/load`:
 * ```typescript
 * import { createLoadModule } from '@lattice/view/load';
 * ```
 */

// =============================================================================
// Primary API - Module for composition
// =============================================================================

export { ResourceModule, createResourceFactory } from './resource';
export type { ResourceDeps } from './resource';

// =============================================================================
// Core Types
// =============================================================================

export type {
  Resource,
  ResourceState,
  Fetcher,
  ResourceFactory,
} from './types';
