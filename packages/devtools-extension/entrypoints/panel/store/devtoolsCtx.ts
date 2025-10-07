import { createApi } from '@lattice/lattice';
import { createSignalFactory, type SignalFunction } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import type { ContextInfo, LogEntry } from './types';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

function createContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const pullPropagator = createPullPropagator({ track: graphEdges.track });

  return {
    ctx,
    trackDependency: graphEdges.trackDependency,
    propagate: scheduler.propagate,
    track: graphEdges.track,
    dispose: scheduler.dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
    startBatch: scheduler.startBatch,
    endBatch: scheduler.endBatch,
  };
}

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createApi(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
  },
  createContext()
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
