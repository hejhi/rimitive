// Log entry for any instrumentation event
export interface LogEntry {
  id: string;
  timestamp: number;
  eventType: string; // The event type from instrumentation
  level: number; // indentation level for display
  nodeId?: string; // Resource ID if available
  nodeName?: string; // Resource name if available
  contextId: string;
  data: Record<string, unknown>; // The raw event data
  // Derived fields for display
  category: string; // Inferred from event type
  summary?: string; // Human-readable summary
  rawData?: unknown; // For TransactionDetail component
}

// Generic event data shape - instrumentation emits these
export interface ResourceEventData {
  id: string;
  name?: string;
  type?: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  duration?: number;
  dependencies?: Array<{ id: string; name?: string }>;
  subscribers?: Array<{ id: string; name?: string }>;
  [key: string]: unknown; // Allow any other fields from instrumentation
}

// Context info
export interface ContextInfo {
  id: string;
  name: string;
  created?: number;
}

export interface DevToolsState {
  connected: boolean;
  contexts: ContextInfo[];
  selectedContext: string | null;
  selectedTransaction: string | null;
  selectedTab: 'logs' | 'timeline';
  filter: {
    type: string; // Generic type filter
    search: string;
    hideInternal: boolean;
  };
  logEntries: LogEntry[];
}

