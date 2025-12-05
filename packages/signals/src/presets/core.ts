/**
 * Core Signals Preset
 * Pre-configured bundle of signal primitives with all necessary helpers wired up.
 * This eliminates the boilerplate of manually creating and wiring helpers.
 */

import { Signal } from '../signal';
import { Computed } from '../computed';
import { Effect } from '../effect';
import { Batch } from '../batch';
import { Subscribe } from '../subscribe';
import { createGraphEdges, type GraphEdges } from '../helpers/graph-edges';
import {
  createGraphTraversal,
  type GraphTraversal,
} from '../helpers/graph-traversal';
import {
  createPullPropagator,
  type PullPropagator,
} from '../helpers/pull-propagator';
import { createScheduler, type Scheduler } from '../helpers/scheduler';
import { createUntracked } from '../untrack';
import { composeFrom, type DefinedService, type Svc } from '@lattice/lattice';
import type { Dependency } from '../types';

/**
 * Combined helpers type - all reactive graph operations
 */
export type Helpers = {
  untrack: <T>(fn: () => T) => T;
  propagate: (subscribers: Dependency) => void;
} & GraphEdges &
  GraphTraversal &
  PullPropagator &
  Omit<Scheduler, 'withPropagate'>;

// Re-export user-facing types
// Note: Internal dependency types (*Deps) are intentionally not exported.
// They are wired automatically by presets and helpers.

// Signal types
export type {
  SignalFactory,
  SignalService,
  SignalOptions,
  SignalFunction,
} from '../signal';

// Computed types
export type {
  ComputedFactory,
  ComputedService,
  ComputedOptions,
  ComputedFunction,
} from '../computed';

// Effect types
export type { EffectFactory, EffectService, EffectOptions } from '../effect';

// Batch types
export type { BatchFactory, BatchService, BatchOptions } from '../batch';

// Subscribe types
export type {
  SubscribeFactory,
  SubscribeService,
  SubscribeOptions,
  SubscribeFunction,
} from '../subscribe';

// Lattice composition types
export type { DefinedService } from '@lattice/lattice';

// Import service types for DefaultExtensions
import type { SignalService } from '../signal';
import type { ComputedService } from '../computed';
import type { EffectService } from '../effect';
import type { BatchService } from '../batch';
import type { SubscribeService } from '../subscribe';

/**
 * The set of instantiable services created by defaultExtensions().
 *
 * Each property is a service that can be composed with composeFrom().
 * Use this type when extending the default signal primitives:
 *
 * @example
 * ```ts
 * import { defaultExtensions, type DefaultExtensions } from '@lattice/signals/presets/core';
 *
 * const extensions: DefaultExtensions = defaultExtensions();
 * // extensions.signal, extensions.computed, etc. are all services
 * ```
 */
export type DefaultExtensions = {
  signal: SignalService;
  computed: ComputedService;
  effect: EffectService;
  batch: BatchService;
  subscribe: SubscribeService;
};

export function defaultExtensions<T extends Record<string, DefinedService>>(
  extensions?: T
): DefaultExtensions & T {
  return {
    signal: Signal(),
    computed: Computed(),
    effect: Effect(),
    batch: Batch(),
    subscribe: Subscribe(),
    ...extensions,
  } as DefaultExtensions & T;
}

export function createHelpers(): Helpers {
  const edges = createGraphEdges();
  const untrack = createUntracked({ consumer: edges.consumer });
  const traversal = createGraphTraversal();
  const pull = createPullPropagator({ track: edges.track });
  const { withPropagate, ...scheduler } = createScheduler({
    detachAll: edges.detachAll,
  });

  return {
    untrack,
    ...edges,
    ...traversal,
    ...pull,
    ...scheduler,
    propagate: withPropagate(traversal.withVisitor),
  };
}

/**
 * Type of the signals service returned by createSignalsSvc
 *
 * Uses Svc<> to automatically extract impl types from the extensions object.
 */
export type SignalsSvc = Svc<DefaultExtensions>;

export function createSignalsSvc(): SignalsSvc {
  return composeFrom(defaultExtensions(), createHelpers());
}
