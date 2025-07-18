import { devtoolsStore } from '../devtoolsCtx';
import {
  LogEntry,
  SignalWriteData,
  SignalReadData,
  SignalWriteLogDetails,
  SignalReadLogDetails,
  ComputedRunLogDetails,
  ComputedCompleteLogDetails,
  EffectRunLogDetails,
  EffectCompleteLogDetails,
  SelectorCreatedLogDetails,
  SELECTOR_CREATED,
  BATCH_START,
  BatchLogDetails,
  DependencyUpdateData,
  GraphSnapshotData,
  NamedItemData,
  ComputedEndEventData,
  EffectEndEventData,
  SelectorCreatedEventData,
} from '../types';
import { LatticeEvent } from './messageHandler';
import { updateDependencyGraph, updateGraphSnapshot } from './dependencyGraph';

// Simple execution tracking for level calculation
let currentLevel = 0;
const recentWrites: { id: string; timestamp: number }[] = [];

// Helper type to extract node ID from different event data types
type EventDataWithId =
  | SignalWriteData
  | SignalReadData
  | NamedItemData
  | ComputedEndEventData
  | EffectEndEventData
  | SelectorCreatedEventData
  | { batchId: string };

function getNodeId(data: EventDataWithId): string {
  if ('batchId' in data) return data.batchId;
  return data.id;
}

function getNodeName(
  data: EventDataWithId,
  node: ReturnType<typeof devtoolsStore.state.dependencyGraph.value.nodes.get>,
  type: LogEntry['type']
): string | undefined {
  if ('name' in data && data.name) return data.name;
  if ('selector' in data && data.selector) return data.selector;
  if (node?.name) return node.name;
  if (type.includes('batch')) return 'Batch';
  return undefined;
}

// Generic log entry factory to eliminate duplication
function createLogEntry(
  event: LatticeEvent,
  timestamp: number,
  type: LogEntry['type'],
  category: LogEntry['category'],
  details: LogEntry['details'],
  level = currentLevel,
  nodeId?: string,
  nodeName?: string
): LogEntry {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const data = event.data as EventDataWithId;
  const id = nodeId || getNodeId(data);
  const node = graph.nodes.get(id);

  return {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type,
    level,
    nodeId: id,
    nodeName: nodeName || getNodeName(data, node, type),
    contextId: event.contextId,
    details,
    eventType: event.type,
    rawData: event.data,
    category,
  };
}

// Find what triggered a computed/effect based on recent writes
function findTriggeredBy(nodeId: string): string[] {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const dependencies = graph.reverseEdges.get(nodeId) || new Set();

  for (const write of recentWrites) {
    if (dependencies.has(write.id)) {
      return [write.id];
    }
  }
  return [];
}

export function processLogEntry(event: LatticeEvent) {
  const timestamp = event.timestamp || Date.now();

  switch (event.type) {
    case 'SIGNAL_WRITE':
      processSignalWrite(event, timestamp);
      break;
    case 'SIGNAL_READ':
      processSignalRead(event, timestamp);
      break;
    case 'COMPUTED_START':
      processComputedStart(event, timestamp);
      break;
    case 'COMPUTED_END':
      processComputedEnd(event, timestamp);
      break;
    case 'EFFECT_START':
      processEffectStart(event, timestamp);
      break;
    case 'EFFECT_END':
      processEffectEnd(event, timestamp);
      break;
    case 'SELECTOR_CREATED':
      processSelectorCreated(event, timestamp);
      break;
    case 'BATCH_START':
      processBatchStart(event, timestamp);
      break;
    case 'BATCH_END':
      processBatchEnd(event, timestamp);
      break;
    case 'DEPENDENCY_UPDATE':
      updateDependencyGraph(
        event.data as DependencyUpdateData,
        event.contextId
      );
      break;
    case 'GRAPH_SNAPSHOT':
      updateGraphSnapshot(
        event.data as GraphSnapshotData,
        timestamp,
        event.contextId
      );
      break;
  }
}

function processSignalWrite(event: LatticeEvent, timestamp: number) {
  const data = event.data as SignalWriteData;
  const graph = devtoolsStore.state.dependencyGraph.value;

  // Find all dependencies that will be triggered
  const triggeredDeps = Array.from(graph.edges.get(data.id) || new Set());

  // Track recent write for simple causality
  recentWrites.push({ id: data.id, timestamp });
  // Keep only writes from last 100ms
  const cutoff = timestamp - 100;
  while (recentWrites.length > 0 && recentWrites[0].timestamp < cutoff) {
    recentWrites.shift();
  }

  addLogEntry(
    createLogEntry(
      event,
      timestamp,
      'signal-write',
      'signal',
      {
        oldValue: data.oldValue,
        newValue: data.newValue,
        triggeredDependencies: triggeredDeps,
      } as SignalWriteLogDetails,
      0
    )
  );
}

function processSignalRead(event: LatticeEvent, timestamp: number) {
  const data = event.data as SignalReadData;
  if (data.internal) return; // Skip internal reads

  addLogEntry(
    createLogEntry(
      event,
      timestamp,
      'signal-read',
      'signal',
      {
        value: data.value,
        readBy: data.executionContext || 'unknown',
        readByName: data.readContext?.name,
      } as SignalReadLogDetails,
      currentLevel + 1
    )
  );
}

function processComputedStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as NamedItemData;
  const triggeredBy = findTriggeredBy(data.id);

  addLogEntry(
    createLogEntry(event, timestamp, 'computed-run', 'computed', {
      triggeredBy,
    } as ComputedRunLogDetails)
  );

  currentLevel++;
}

function processComputedEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as ComputedEndEventData;
  currentLevel = Math.max(0, currentLevel - 1);

  addLogEntry(
    createLogEntry(event, timestamp, 'computed-complete', 'computed', {
      value: data.value,
      oldValue: undefined,
      duration: data.duration || 0,
    } as ComputedCompleteLogDetails)
  );
}

function processEffectStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as NamedItemData;
  const triggeredBy = findTriggeredBy(data.id);

  addLogEntry(
    createLogEntry(event, timestamp, 'effect-run', 'effect', {
      triggeredBy,
    } as EffectRunLogDetails)
  );

  currentLevel++;
}

function processEffectEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as EffectEndEventData;
  currentLevel = Math.max(0, currentLevel - 1);

  addLogEntry(
    createLogEntry(event, timestamp, 'effect-complete', 'effect', {
      duration: data.duration || 0,
    } as EffectCompleteLogDetails)
  );
}

function processSelectorCreated(event: LatticeEvent, timestamp: number) {
  const data = event.data as SelectorCreatedEventData;

  addLogEntry(
    createLogEntry(
      event,
      timestamp,
      'selector-created',
      'selector',
      {
        type: SELECTOR_CREATED,
        sourceId: data.sourceId,
        sourceName: data.sourceName,
        sourceType: data.sourceType,
        selector: data.selector,
      } as SelectorCreatedLogDetails,
      0
    )
  );
}

function processBatchStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as { batchId: string };

  addLogEntry(
    createLogEntry(
      event,
      timestamp,
      'batch-start',
      'batch',
      {
        type: BATCH_START,
        batchId: data.batchId,
      } as BatchLogDetails,
      0
    )
  );
}

function processBatchEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as { batchId: string };

  addLogEntry(
    createLogEntry(
      event,
      timestamp,
      'batch-end',
      'batch',
      {
        type: BATCH_START, // Both use same details type
        batchId: data.batchId,
      } as BatchLogDetails,
      0
    )
  );
}

function addLogEntry(entry: LogEntry) {
  // Keep last 1000 log entries
  devtoolsStore.state.logEntries.value = [
    ...devtoolsStore.state.logEntries.value.slice(-999),
    entry,
  ];
}
