/**
 * @lattice/signals - Reactive primitives for Lattice
 *
 * ## Quick Start
 * ```typescript
 * import { createSignals } from '@lattice/signals';
 *
 * const { signal, computed, effect } = createSignals()();
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Quick start | `import { createSignals } from '@lattice/signals'` |
 * | Custom composition | `import { SignalModule, ComputedModule } from '@lattice/signals/extend'` |
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
// Primary API - What most users need
// =============================================================================

export { createSignals, deps } from './presets/core';
export type {
  SignalsSvc,
  Helpers,
  // Factory types
  SignalFactory,
  ComputedFactory,
  EffectFactory,
  BatchFactory,
  SubscribeFunction,
  SubscribeCallback,
  UnsubscribeFunction,
} from './presets/core';

// =============================================================================
// Core Types - For typing behaviors and components
// =============================================================================

export type { Readable, Writable, Reactive } from './types';
export type { SignalFunction } from './signal';
export type { ComputedFunction } from './computed';
