// Log entry for any instrumentation event
export type LogEntry = {
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
};

// Context info
export type ContextInfo = {
  id: string;
  name: string;
  created?: number;
};

export type ConnectionStatus = 'disconnected' | 'reconnecting' | 'connected';

export type DevToolsState = {
  connected: boolean;
  connectionStatus: ConnectionStatus;
  contexts: ContextInfo[];
  selectedContext: string | null;
  selectedTransaction: string | null;
  filter: {
    type: string; // Generic type filter
    search: string;
    hideInternal: boolean;
    nodeId: string | null; // Filter by specific resource ID
  };
  logEntries: LogEntry[];
};
