/**
 * @lattice/resource - Async data fetching with reactive dependency tracking
 *
 * ## Quick Start
 * ```typescript
 * import { ResourceModule } from '@lattice/resource';
 * import { compose, instantiate } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 *
 * const modules = compose(SignalModule, ComputedModule, EffectModule, ResourceModule);
 * const { resource } = instantiate(modules);
 *
 * const products = resource(() =>
 *   fetch('/api/products').then(r => r.json())
 * );
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Module composition | `import { ResourceModule } from '@lattice/resource'` |
 * | Types only | `import type { Resource, ResourceState } from '@lattice/resource'` |
 */

// =============================================================================
// Primary API - Module for composition
// =============================================================================

export { ResourceModule } from './resource';

// =============================================================================
// Core Types - For typing behaviors and components
// =============================================================================

export type { Resource, ResourceState, Fetcher, ResourceFactory } from './types';
