// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import React, { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createSignalAPI, type FactoriesToAPI } from '@lattice/signals/api';
import { createSignalFactory, SignalFunction } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedFunction } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import type { LatticeExtension } from '@lattice/lattice';
import { SignalProvider } from './signals/context';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

export function createContext() {
  const baseCtx = createBaseContext();
  const graphEdges = createGraphEdges();
  const scheduler = createScheduler();

  // Build the context that matches what the factories expect
  const ctx = {
    ...baseCtx,
    ctx: baseCtx,
    graphEdges,
    scheduler,
    push: { pushUpdates: scheduler.propagate },
    pull: null as unknown as ReturnType<typeof createPullPropagator>,
  };

  const pullPropagator = createPullPropagator(baseCtx, graphEdges);
  ctx.pull = pullPropagator;

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
    (fn: () => void | (() => void)) => () => void
  >,
  batch: createBatchFactory as (
    ctx: unknown
  ) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
} as const;

// Type alias for the API created with our standard factories
type TestSignalAPI = FactoriesToAPI<typeof testFactories, ReturnType<typeof createContext>>;

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
