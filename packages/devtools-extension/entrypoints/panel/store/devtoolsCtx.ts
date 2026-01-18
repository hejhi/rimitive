import type { ConnectionStatus, ContextInfo, LogEntry } from './types';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';

// Create a Rimitive context for the devtools panel itself
export const devtoolsContext = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule
);

export type TabId = 'logs' | 'graph' | 'timeline';

export const devtoolsState = {
  connected: devtoolsContext.signal(false),
  connectionStatus: devtoolsContext.signal<ConnectionStatus>('disconnected'),
  contexts: devtoolsContext.signal<ContextInfo[]>([]),
  selectedContext: devtoolsContext.signal<string | null>(null),
  selectedTransaction: devtoolsContext.signal<string | null>(null),
  activeTab: devtoolsContext.signal<TabId>('logs'),
  filter: devtoolsContext.signal({
    type: 'all',
    search: '',
    hideInternal: true,
    nodeId: null as string | null,
  }),
  logEntries: devtoolsContext.signal<LogEntry[]>([]),
};
