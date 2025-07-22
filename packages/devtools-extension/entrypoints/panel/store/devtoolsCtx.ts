import { createLattice } from '@lattice/lattice';
import type { SignalState } from '@lattice/lattice';
import type { DevToolsState, ContextInfo, GraphSnapshot, LogEntry } from './types';

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createLattice();

// Create signals for each piece of state
export const devtoolsState: SignalState<DevToolsState> = {
  connected: devtoolsContext.signal(false),
  contexts: devtoolsContext.signal<ContextInfo[]>([]),
  selectedContext: devtoolsContext.signal<string | null>(null),
  selectedTransaction: devtoolsContext.signal<string | null>(null),
  selectedTab: devtoolsContext.signal<'logs' | 'timeline' | 'graph'>('logs'),
  filter: devtoolsContext.signal({
    type: 'all',
    search: '',
    hideInternal: true,
  }),
  dependencyGraph: devtoolsContext.signal({
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  }),
  lastSnapshot: devtoolsContext.signal<GraphSnapshot | null>(null),
  logEntries: devtoolsContext.signal<LogEntry[]>([]),
};
