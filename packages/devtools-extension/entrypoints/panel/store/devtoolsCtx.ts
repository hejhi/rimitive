import { createContext as createLatticeContext } from '@lattice/lattice';
import { Signal, type SignalFunction } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import type { ContextInfo, LogEntry } from './types';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

function createContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const { withPropagate, dispose, startBatch, endBatch } = createScheduler({
    detachAll,
  });
  const pullPropagator = createPullPropagator({ track });

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
  };
}

// Create a Lattice context for the devtools panel itself
const ctx = createContext();
export const devtoolsContext = createLatticeContext(
  Signal().create(ctx),
  Computed().create(ctx),
  Effect().create(ctx),
  Batch().create(ctx)
);

// Create signals for each piece of state
interface DevtoolsStateSignals {
  connected: SignalFunction<boolean>;
  contexts: SignalFunction<ContextInfo[]>;
  selectedContext: SignalFunction<string | null>;
  selectedTransaction: SignalFunction<string | null>;
  selectedTab: SignalFunction<'logs' | 'timeline'>;
  filter: SignalFunction<{
    type: string;
    search: string;
    hideInternal: boolean;
  }>;
  logEntries: SignalFunction<LogEntry[]>;
}

export const devtoolsState: DevtoolsStateSignals = {
  connected: devtoolsContext.signal(false),
  contexts: devtoolsContext.signal<ContextInfo[]>([]),
  selectedContext: devtoolsContext.signal<string | null>(null),
  selectedTransaction: devtoolsContext.signal<string | null>(null),
  selectedTab: devtoolsContext.signal<'logs' | 'timeline'>('logs'),
  filter: devtoolsContext.signal({
    type: 'all',
    search: '',
    hideInternal: true,
  }),
  logEntries: devtoolsContext.signal<LogEntry[]>([]),
};
