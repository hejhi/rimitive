import type { ContextInfo, LogEntry } from './types';

import { createSignals } from '@lattice/signals/presets/core';

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createSignals()();

export const devtoolsState = {
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
