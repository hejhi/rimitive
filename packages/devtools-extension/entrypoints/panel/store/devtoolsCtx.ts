import { createLattice } from '@lattice/signals-store';
import type { SignalState } from '@lattice/signals-store';
import type { DevToolsState, ContextInfo, LogEntry } from './types';

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createLattice();

// Create signals for each piece of state
export const devtoolsState: SignalState<DevToolsState> = {
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
