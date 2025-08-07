import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import type { Signal } from '@lattice/signals/signal';
import type { ContextInfo, LogEntry } from './types';

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
}, createDefaultContext());

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
