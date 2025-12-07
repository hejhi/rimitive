/**
 * @lattice/signals - Reactive primitives for Lattice
 *
 * ## Quick Start
 * ```typescript
 * import { createSignalsSvc } from '@lattice/signals';
 *
 * const { signal, computed, effect } = createSignalsSvc();
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Quick start | `import { createSignalsSvc } from '@lattice/signals'` |
 * | Custom composition | `import { Signal, Computed, createHelpers } from '@lattice/signals/extend'` |
 * | Types only | `import type { Readable, SignalFunction } from '@lattice/signals'` |
 *
 * ### Without a bundler
 *
 * The `/extend` path re-exports from individual modules for discoverability.
 * Bundlers tree-shake unused exports, but without a bundler each import
 * triggers a separate network request. For bundler-free usage, import directly:
 *
 * ```typescript
 * import { Signal } from '@lattice/signals/signal';
 * import { Computed } from '@lattice/signals/computed';
 * ```
 */

// =============================================================================
// Primary API - What most users need
// =============================================================================

export { createSignalsSvc, createHelpers } from './presets/core';
export type {
  SignalsSvc,
  Helpers,
  // Service types
  SignalService,
  SignalFactory,
  SignalOptions,
  ComputedService,
  ComputedFactory,
  ComputedOptions,
  EffectService,
  EffectFactory,
  EffectOptions,
  BatchService,
  BatchFactory,
  BatchOptions,
  SubscribeService,
  SubscribeFactory,
  SubscribeOptions,
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
