// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { createElement, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createApi } from '@lattice/lattice';
import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { SignalProvider } from './signals/context';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

export function createContext() {
  const ctx = createBaseContext();
  const { trackDependency, detachAll, track } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const { withPropagate, dispose, startBatch, endBatch } = createScheduler({ detachAll });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });

  return {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    track,
    dispose,
    pullUpdates,
    shallowPropagate,
    startBatch,
    endBatch,
  };
}

// Define the components for consistent usage
const testComponents = {
  signal: Signal(),
  computed: Computed(),
  effect: Effect(),
  batch: Batch(),
} as const;

// Type alias for the API created with our standard components
type TestSignalAPI = ReturnType<
  typeof createApi<typeof testComponents, ReturnType<typeof createContext>>
>;

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal API for each test
  const api = createApi(testComponents, createContext());

  return render(createElement(SignalProvider, { api, children: ui }));
}

// Also export api creation for tests that need direct access
export function createTestSignalAPI(): TestSignalAPI {
  return createApi(testComponents, createContext());
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
