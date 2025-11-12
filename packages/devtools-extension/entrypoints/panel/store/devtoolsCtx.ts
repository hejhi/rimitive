import type { SignalFunction } from '@lattice/signals/signal';
import type { ContextInfo, LogEntry } from './types';

import { createApi } from '@lattice/lattice';
import { defaultExtensions, defaultHelpers } from '@lattice/signals/presets/core';


// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createApi(defaultExtensions(), defaultHelpers());

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
