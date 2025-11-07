/**
 * Instrumented Signals API
 *
 * Creates and exports the signals API with DevTools instrumentation.
 * Provides: signal, computed, effect, batch
 */

import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import { devtoolsProvider, createInstrumentation, createContext as createLatticeContext } from '@lattice/lattice';

function createSignalContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const { withPropagate, dispose, startBatch, endBatch } = createScheduler({ detachAll });
  const pullPropagator = createPullPropagator({ track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: true })],
  });

  return {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    track,
    dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    startBatch,
    endBatch,
    instrumentation,
  };
}

// Create context
const signalCtx = createSignalContext();

// Create signal extensions with instrumentation
const signalExtensions = [
  Signal().create({ ...signalCtx, instrument: instrumentSignal }),
  Computed().create({ ...signalCtx, instrument: instrumentComputed }),
  Effect().create({ ...signalCtx, instrument: instrumentEffect }),
  Batch().create({ ...signalCtx, instrument: instrumentBatch }),
];

export const signalsApi = createLatticeContext(
  { instrumentation: signalCtx.instrumentation },
  ...signalExtensions
);

export const { signal, computed, effect, batch } = signalsApi;

// Export the context for use in view API
export { signalCtx };
