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
} from '../types';
import { LatticeEvent } from './messageHandler';
import {
  NamedItemData,
  ComputedEndEventData,
  EffectEndEventData,
  SelectorCreatedEventData,
} from './eventTypes';
import { updateDependencyGraph, updateGraphSnapshot } from './dependencyGraph';

// Simple execution tracking for level calculation
let currentLevel = 0;
const recentWrites: { id: string; timestamp: number }[] = [];

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
      updateDependencyGraph(event.data as DependencyUpdateData);
      break;
    case 'GRAPH_SNAPSHOT':
      updateGraphSnapshot(event.data as GraphSnapshotData, timestamp);
      break;
  }
}

function processSignalWrite(event: LatticeEvent, timestamp: number) {
  const data = event.data as SignalWriteData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  // Find all dependencies that will be triggered
  const triggeredDeps: string[] = [];
  const subscribers = graph.edges.get(data.id) || new Set();
  subscribers.forEach((subId) => triggeredDeps.push(subId));

  // Track recent write for simple causality
  recentWrites.push({ id: data.id, timestamp });
  // Keep only writes from last 100ms
  const cutoff = timestamp - 100;
  while (recentWrites.length > 0 && recentWrites[0].timestamp < cutoff) {
    recentWrites.shift();
  }

  // Add write log entry
  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'signal-write',
    level: 0,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      oldValue: data.oldValue,
      newValue: data.newValue,
      triggeredDependencies: triggeredDeps,
    } as SignalWriteLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'signal',
  };

  addLogEntry(logEntry);
}

function processSignalRead(event: LatticeEvent, timestamp: number) {
  const data = event.data as SignalReadData;
  if (data.internal) return; // Skip internal reads

  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'signal-read',
    level: currentLevel + 1,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      value: data.value,
      readBy: data.executionContext || 'unknown',
      readByName: data.readContext?.name,
    } as SignalReadLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'signal',
  };

  addLogEntry(logEntry);
}

function processComputedStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as NamedItemData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  // Simple causality: find recent writes to dependencies
  const triggeredBy: string[] = [];
  const dependencies = graph.reverseEdges.get(data.id) || new Set();
  for (const write of recentWrites) {
    if (dependencies.has(write.id)) {
      triggeredBy.push(write.id);
      break;
    }
  }

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'computed-run',
    level: currentLevel,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      triggeredBy,
    } as ComputedRunLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'computed',
  };

  addLogEntry(logEntry);
  currentLevel++; // Increase level for nested operations
}

function processComputedEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as ComputedEndEventData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  currentLevel = Math.max(0, currentLevel - 1); // Decrease level after computed

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'computed-complete',
    level: currentLevel,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      value: data.value,
      oldValue: undefined, // We don't track this anymore
      duration: data.duration || 0,
    } as ComputedCompleteLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'computed',
  };

  addLogEntry(logEntry);
}

function processEffectStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as NamedItemData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  // Simple causality: find recent writes to dependencies
  const triggeredBy: string[] = [];
  const dependencies = graph.reverseEdges.get(data.id) || new Set();
  for (const write of recentWrites) {
    if (dependencies.has(write.id)) {
      triggeredBy.push(write.id);
      break;
    }
  }

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'effect-run',
    level: currentLevel,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      triggeredBy,
    } as EffectRunLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'effect',
  };

  addLogEntry(logEntry);
  currentLevel++; // Increase level for nested operations
}

function processEffectEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as EffectEndEventData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  currentLevel = Math.max(0, currentLevel - 1); // Decrease level after effect

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'effect-complete',
    level: currentLevel,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      duration: data.duration || 0,
    } as EffectCompleteLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'effect',
  };

  addLogEntry(logEntry);
}

function processSelectorCreated(event: LatticeEvent, timestamp: number) {
  const data = event.data as SelectorCreatedEventData;

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'selector-created',
    level: 0,
    nodeId: data.id,
    nodeName: data.selector,
    contextId: event.contextId,
    details: {
      type: SELECTOR_CREATED,
      sourceId: data.sourceId,
      sourceName: data.sourceName,
      sourceType: data.sourceType,
      selector: data.selector,
    } as SelectorCreatedLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'selector',
  };

  addLogEntry(logEntry);
}

function processBatchStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as { batchId: string };

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'batch-start',
    level: 0,
    nodeId: data.batchId,
    nodeName: 'Batch',
    contextId: event.contextId,
    details: {
      type: BATCH_START,
      batchId: data.batchId,
    } as BatchLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'batch',
  };

  addLogEntry(logEntry);
}

function processBatchEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as { batchId: string };

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'batch-end',
    level: 0,
    nodeId: data.batchId,
    nodeName: 'Batch',
    contextId: event.contextId,
    details: {
      type: BATCH_START, // Both use same details type
      batchId: data.batchId,
    } as BatchLogDetails,
    eventType: event.type,
    rawData: event.data,
    category: 'batch',
  };

  addLogEntry(logEntry);
}

function addLogEntry(entry: LogEntry) {
  // Keep last 1000 log entries
  devtoolsStore.state.logEntries.value = [
    ...devtoolsStore.state.logEntries.value.slice(-999),
    entry,
  ];
}

