import { createSignalAPI, GlobalContext } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { ComputedContext, createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory, EffectContext } from '@lattice/signals/effect';
import { BatchContext, createBatchFactory } from '@lattice/signals/batch';
import type { Signal, SignalContext } from '@lattice/signals/signal';
import type { ContextInfo, LogEntry } from './types';
import { createBaseContext } from 'node_modules/@lattice/signals/src/context';
import { createGraphEdges } from 'node_modules/@lattice/signals/src/helpers/graph-edges';
import { createPushPropagator } from 'node_modules/@lattice/signals/src/helpers/push-propagator';
import { createPullPropagator } from 'node_modules/@lattice/signals/src/helpers/pull-propagator';
import { createNodeScheduler, NodeScheduler } from 'node_modules/@lattice/signals/src/helpers/node-scheduler';

function createContext(): GlobalContext &
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

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
  },
  createContext()
);

// Create signals for each piece of state
// Create individual signals for each piece of state
interface DevtoolsStateSignals {
  connected: Signal<boolean>;
  contexts: Signal<ContextInfo[]>;
  selectedContext: Signal<string | null>;
  selectedTransaction: Signal<string | null>;
  selectedTab: Signal<'logs' | 'timeline'>;
  filter: Signal<{
    type: string;
    search: string;
    hideInternal: boolean;
  }>;
  logEntries: Signal<LogEntry[]>;
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
