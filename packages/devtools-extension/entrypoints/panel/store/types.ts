export const SIGNAL_WRITE = 'signal-write';
export const SIGNAL_READ = 'signal-read';
export const COMPUTED_RUN = 'computed-run';
export const COMPUTED_COMPLETE = 'computed-complete';
export const EFFECT_RUN = 'effect-run';
export const EFFECT_COMPLETE = 'effect-complete';
export const BATCH_START = 'batch-start';
export const BATCH_END = 'batch-end';
export const SELECTOR_CREATED = 'selector-created';

export const LogEntryTypes = {
  SIGNAL_WRITE,
  SIGNAL_READ,
  COMPUTED_RUN,
  COMPUTED_COMPLETE,
  EFFECT_RUN,
  EFFECT_COMPLETE,
  BATCH_START,
  BATCH_END,
  SELECTOR_CREATED,
} as const;

// Log entry types for CLI-style display
export type LogEntryType = (typeof LogEntryTypes)[keyof typeof LogEntryTypes];

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogEntryType;
  level: number; // indentation level
  nodeId: string;
  nodeName?: string;
  contextId: string;
  details: LogEntryDetails;
  // Raw event data for Timeline view
  eventType: string;
  rawData: unknown;
  category: 'signal' | 'computed' | 'effect' | 'batch' | 'selector';
}

export type LogEntryDetails =
  | SignalWriteLogDetails
  | SignalReadLogDetails
  | ComputedRunLogDetails
  | ComputedCompleteLogDetails
  | EffectRunLogDetails
  | EffectCompleteLogDetails
  | BatchLogDetails
  | SelectorCreatedLogDetails;

export interface SignalWriteLogDetails {
  type: typeof SIGNAL_WRITE;
  oldValue: unknown;
  newValue: unknown;
  triggeredDependencies: string[];
}

export interface SignalReadLogDetails {
  type: typeof SIGNAL_READ;
  value: unknown;
  readBy: string;
  readByName?: string;
}

export interface ComputedRunLogDetails {
  type: typeof COMPUTED_RUN;
  triggeredBy: string[];
}

export interface ComputedCompleteLogDetails {
  type: typeof COMPUTED_COMPLETE;
  value: unknown;
  oldValue?: unknown;
  duration: number;
}

export interface EffectRunLogDetails {
  type: typeof EFFECT_RUN;
  triggeredBy: string[];
}

export interface EffectCompleteLogDetails {
  type: typeof EFFECT_COMPLETE;
  duration: number;
}

export interface BatchLogDetails {
  type: typeof BATCH_START;
  batchId: string;
}

export interface SelectorCreatedLogDetails {
  type: typeof SELECTOR_CREATED;
  sourceId: string;
  sourceName?: string;
  sourceType: 'signal' | 'computed';
  selector: string;
}

export interface DevToolsState {
  connected: boolean;
  contexts: ContextInfo[];
  selectedContext: string | null;
  selectedTransaction: string | null;
  selectedTab: 'logs' | 'timeline' | 'graph';
  filter: {
    type: 'all' | 'signal' | 'computed' | 'effect' | 'selector';
    search: string;
    hideInternal: boolean;
  };
  dependencyGraph: DependencyGraph;
  lastSnapshot: GraphSnapshot | null;
  logEntries: LogEntry[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>; // source -> targets
  reverseEdges: Map<string, Set<string>>; // target -> sources
}

export interface DependencyNode {
  id: string;
  type: 'signal' | 'computed' | 'effect' | 'selector';
  name?: string;
  value?: unknown;
  isActive: boolean;
  isOutdated?: boolean;
  hasSubscribers?: boolean;
  contextId?: string;
}

export interface GraphSnapshot {
  timestamp: number;
  nodes: DependencyNode[];
  edges: Array<{ source: string; target: string; isActive: boolean }>;
}

export interface ContextInfo {
  id: string;
  name: string;
  signalCount: number;
  computedCount: number;
  effectCount: number;
}

export interface SignalInfo {
  id: string;
  name?: string;
  value: unknown;
  lastUpdated: number;
}

export interface ComputedInfo {
  id: string;
  name?: string;
  value: unknown;
  dependencies: string[];
  lastComputed: number;
  executionContext?: string | null;
}

export interface EffectInfo {
  id: string;
  name?: string;
  isActive: boolean;
  lastRun: number;
}

// Transaction data types
export interface SignalReadData {
  id: string;
  name?: string;
  value: unknown;
  internal?: string;
  executionContext?: string | null;
  readContext?: {
    type: string;
    id: string;
    name?: string;
  };
}

export interface SignalWriteData {
  id: string;
  name?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SignalCreatedData {
  id: string;
  name?: string;
  initialValue: unknown;
}

export interface NamedItemData {
  id: string;
  name?: string;
}

export interface ComputedEndEventData {
  id: string;
  name?: string;
  duration?: number;
  value?: unknown;
}

export interface EffectEndEventData {
  id: string;
  name?: string;
  duration?: number;
}

export interface SelectorCreatedEventData {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType: 'signal' | 'computed';
  selector: string;
}

export interface DependencyUpdateData {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  trigger: 'created' | 'updated' | 'executed';
  dependencies: Array<{ id: string; name?: string }>;
  subscribers: Array<{ id: string; name?: string }>;
  value?: unknown;
}

export interface GraphSnapshotData {
  nodes: Array<{
    id: string;
    type: 'signal' | 'computed' | 'effect';
    name?: string;
    value?: unknown;
    isActive: boolean;
    isOutdated?: boolean;
    hasSubscribers?: boolean;
    contextId?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    isActive: boolean;
  }>;
}

