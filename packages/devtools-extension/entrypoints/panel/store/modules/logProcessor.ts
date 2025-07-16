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
  DependencyUpdateData,
  GraphSnapshotData,
} from '../types';
import { LatticeEvent } from './messageHandler';
import {
  createExecutionState,
  trackRecentWrite,
  startComputed,
  endComputed,
  startEffect,
  endEffect,
  findRecentTrigger,
} from './executionState';
import {
  NamedItemData,
  ComputedEndEventData,
  EffectEndEventData,
  SelectorCreatedEventData,
} from './eventTypes';
import { updateDependencyGraph, updateGraphSnapshot } from './dependencyGraph';

// Module-level execution state
const executionState = createExecutionState();

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
    case 'DEPENDENCY_UPDATE':
      updateDependencyGraph(event.data as DependencyUpdateData);
      break;
    case 'GRAPH_SNAPSHOT':
      updateGraphSnapshot(event.data as GraphSnapshotData, timestamp);
      break;
  }
}

function processSignalWrite(event: LatticeEvent, timestamp: number) {
  console.log('Processing SIGNAL_WRITE event');
  const data = event.data as SignalWriteData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  // Find all dependencies that will be triggered
  const triggeredDeps: string[] = [];
  const subscribers = graph.edges.get(data.id) || new Set();
  subscribers.forEach((subId) => triggeredDeps.push(subId));

  // Track recent write for causality
  trackRecentWrite(executionState, data.id, timestamp);

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
    level: executionState.currentLevel + 1,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      value: data.value,
      readBy: data.executionContext || 'unknown',
      readByName: data.readContext?.name,
    } as SignalReadLogDetails,
  };

  addLogEntry(logEntry);
}

function processComputedStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as NamedItemData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  // Determine what triggered this computed
  const triggeredBy: string[] = [];
  const dependencies = graph.reverseEdges.get(data.id) || new Set();
  const recentTrigger = findRecentTrigger(
    executionState,
    data.id,
    dependencies
  );
  if (recentTrigger) {
    triggeredBy.push(recentTrigger);
  }

  startComputed(executionState, data.id, triggeredBy, node?.value, timestamp);

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'computed-run',
    level: executionState.currentLevel - 1,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      triggeredBy,
    } as ComputedRunLogDetails,
  };

  addLogEntry(logEntry);
}

function processComputedEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as ComputedEndEventData;
  const activeComputed = endComputed(executionState, data.id);

  if (!activeComputed) return;

  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'computed-complete',
    level: executionState.currentLevel,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      value: data.value,
      oldValue: activeComputed.oldValue,
      duration: data.duration || 0,
    } as ComputedCompleteLogDetails,
  };

  addLogEntry(logEntry);
}

function processEffectStart(event: LatticeEvent, timestamp: number) {
  const data = event.data as NamedItemData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  // Determine what triggered this effect
  const triggeredBy: string[] = [];
  const dependencies = graph.reverseEdges.get(data.id) || new Set();
  const recentTrigger = findRecentTrigger(
    executionState,
    data.id,
    dependencies
  );
  if (recentTrigger) {
    triggeredBy.push(recentTrigger);
  }

  startEffect(executionState, data.id, triggeredBy, timestamp);

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'effect-run',
    level: executionState.currentLevel - 1,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      triggeredBy,
    } as EffectRunLogDetails,
  };

  addLogEntry(logEntry);
}

function processEffectEnd(event: LatticeEvent, timestamp: number) {
  const data = event.data as EffectEndEventData;
  const activeEffect = endEffect(executionState, data.id);

  if (!activeEffect) return;

  const graph = devtoolsStore.state.dependencyGraph.value;
  const node = graph.nodes.get(data.id);

  const logEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp,
    type: 'effect-complete',
    level: executionState.currentLevel,
    nodeId: data.id,
    nodeName: data.name || node?.name,
    contextId: event.contextId,
    details: {
      duration: data.duration || 0,
    } as EffectCompleteLogDetails,
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

// Export for testing
export { executionState as _executionState };
