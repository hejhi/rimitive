// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import React, { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createSignalAPI, GlobalContext, type FactoriesToAPI } from '@lattice/signals/api';
import { createSignalFactory, SignalContext, SignalFunction } from '@lattice/signals/signal';
import { ComputedContext, createComputedFactory, type ComputedFunction } from '@lattice/signals/computed';
import { createEffectFactory, EffectContext, type EffectDisposer } from '@lattice/signals/effect';
import { BatchContext, createBatchFactory } from '@lattice/signals/batch';
import type { LatticeExtension } from '@lattice/lattice';
import { SignalProvider } from './signals/context';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createPushPropagator } from '@lattice/signals/helpers/push-propagator';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createNodeScheduler, NodeScheduler } from '@lattice/signals/helpers/node-scheduler';

export function createContext(): GlobalContext &
  SignalContext &
  BatchContext &
  EffectContext &
  ComputedContext {
  const baseCtx = createBaseContext();
  const graphEdges = createGraphEdges();
  const pushPropagator = createPushPropagator();

  // Extend baseCtx in place to ensure nodeScheduler uses the same context object
  const ctx = {
    ...baseCtx,
    graphEdges,
    pushPropagator,
    pullPropagator: null as unknown as ReturnType<typeof createPullPropagator>,
    nodeScheduler: null as unknown as NodeScheduler,
  };

  const pullPropagator = createPullPropagator(ctx);
  ctx.pullPropagator = pullPropagator;
  const nodeScheduler = createNodeScheduler(ctx);

  ctx.nodeScheduler = nodeScheduler;

  return ctx;
}

// Define the factories type for consistent usage
const testFactories = {
  signal: createSignalFactory as (
    ctx: unknown
  ) => LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>>,
  computed: createComputedFactory as (
    ctx: unknown
  ) => LatticeExtension<
    'computed',
    <T>(compute: () => T) => ComputedFunction<T>
  >,
  effect: createEffectFactory as (
    ctx: unknown
  ) => LatticeExtension<
    'effect',
    (fn: () => void | (() => void)) => EffectDisposer
  >,
  batch: createBatchFactory as (
    ctx: unknown
  ) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
} as const;

// Type alias for the API created with our standard factories
type TestSignalAPI = FactoriesToAPI<typeof testFactories>;

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal API for each test
  const api = createSignalAPI(testFactories, createContext());

  return render(
    React.createElement(SignalProvider, { api, children: ui })
  );
}

// Also export api creation for tests that need direct access
export function createTestSignalAPI(): TestSignalAPI {
  return createSignalAPI(testFactories, createContext());
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
