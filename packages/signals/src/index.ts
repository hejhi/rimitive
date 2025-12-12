/**
 * @lattice/signals - Reactive primitives for Lattice
 *
 * ## Quick Start
 * ```typescript
 * import { compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
 *
 * const { signal, computed, effect } = compose(SignalModule, ComputedModule, EffectModule);
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Modules | `import { SignalModule, ComputedModule } from '@lattice/signals/extend'` |
 * | Types only | `import type { Readable, SignalFunction } from '@lattice/signals'` |
 *
 * ### Without a bundler
 *
 * The `/extend` path re-exports from individual modules for discoverability.
 * Bundlers tree-shake unused exports, but without a bundler each import
 * triggers a separate network request. For bundler-free usage, import directly:
 *
 * ```typescript
 * import { SignalModule } from '@lattice/signals/signal';
 * import { ComputedModule } from '@lattice/signals/computed';
 * ```
 */

// =============================================================================
// Primary API - Factory functions for composition
// =============================================================================

// Factory types
export type { SignalFactory } from './signal';
export type { ComputedFactory } from './computed';
export type { EffectFactory } from './effect';
export type { BatchFactory } from './batch';
export type { SubscribeFunction, SubscribeCallback, UnsubscribeFunction } from './subscribe';

// =============================================================================
// Core Types - For typing behaviors and components
// =============================================================================

export type { Readable, Writable, Reactive } from './types';
export type { SignalFunction } from './signal';
export type { ComputedFunction } from './computed';
