/**
 * Core Signals Preset
 * Pre-configured bundle of signal primitives with all necessary helpers wired up.
 * This eliminates the boilerplate of manually creating and wiring helpers.
 */

import { Signal, type SignalFactory } from '../signal';
import { Computed, type ComputedFactory } from '../computed';
import { Effect, type EffectFactory } from '../effect';
import { Batch, type BatchFactory } from '../batch';
import { Subscribe, type SubscribeFactory } from '../subscribe';
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
import {
  composeFrom,
  type DefinedService,
  type LatticeContext,
} from '@lattice/lattice';
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

// Re-export types so they're part of the public API
export type {
  SubscribeFactory,
  SubscribeOpts,
  SubscribeProps,
  SubscribeFunction,
} from '../subscribe';
export type {
  SignalFactory,
  SignalOpts,
  SignalProps,
  SignalFunction,
} from '../signal';
export type {
  ComputedFactory,
  ComputedOpts,
  ComputedProps,
  ComputedFunction,
} from '../computed';
export type { EffectFactory, EffectOpts, EffectProps } from '../effect';
export type { BatchFactory, BatchOpts, BatchProps } from '../batch';
export type { DefinedService } from '@lattice/lattice';

export type DefaultExtensions = {
  signal: ReturnType<typeof Signal>;
  computed: ReturnType<typeof Computed>;
  effect: ReturnType<typeof Effect>;
  batch: ReturnType<typeof Batch>;
  subscribe: ReturnType<typeof Subscribe>;
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

type SignalsSvcDefinitions = [
  SignalFactory,
  ComputedFactory,
  EffectFactory,
  BatchFactory,
  SubscribeFactory,
];

export function createSignalsSvc(): LatticeContext<SignalsSvcDefinitions> {
  return composeFrom(
    defaultExtensions(),
    createHelpers()
  ) as LatticeContext<SignalsSvcDefinitions>;
}
