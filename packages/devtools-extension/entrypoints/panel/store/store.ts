import { devtoolsContext, devtoolsStore } from './devtoolsCtx';
import {
  ComputedCompleteLogDetails,
  ComputedRunLogDetails,
  ContextInfo,
  DependencyUpdateData,
  EffectCompleteLogDetails,
  EffectRunLogDetails,
  GraphSnapshotData,
  LogEntry,
  NamedItemData,
  SELECTOR_CREATED,
  SelectorCreatedLogDetails,
  SignalReadData,
  SignalReadLogDetails,
  SignalWriteData,
  SignalWriteLogDetails,
  Transaction,
  TransactionData,
} from './types';

// Helper functions
export interface DevToolsMessage {
  type: string;
  data?: unknown;
}

interface ContextCreatedData {
  name?: string;
}

interface SignalCreatedEventData {
  id: string;
  name?: string;
  initialValue: unknown;
}

interface SignalWriteEventData {
  id: string;
  name?: string;
  oldValue: unknown;
  newValue: unknown;
}

interface ComputedCreatedEventData {
  id: string;
  name?: string;
}

interface EffectCreatedEventData {
  id: string;
  name?: string;
}

interface SelectorCreatedEventData {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType: 'signal' | 'computed';
  selector: string;
}

export function handleDevToolsMessage(message: DevToolsMessage) {
  console.log('[DevTools Store] Handling message:', message);

  switch (message.type) {
    case 'LATTICE_DETECTED':
      console.log('[DevTools Store] Setting connected to true');
      devtoolsStore.state.connected.value = true;
      break;

    case 'STATE_UPDATE':
      console.log('[DevTools Store] Updating state with:', message.data);
      if (message.data && typeof message.data === 'object') {
        const stateData = message.data as {
          connected?: boolean;
          contexts?: ContextInfo[];
          transactions?: Transaction[];
          selectedContext?: string | null;
        };
        if (stateData.connected !== undefined) {
          devtoolsStore.state.connected.value = stateData.connected;
        }
        if (stateData.contexts) {
          devtoolsStore.state.contexts.value = stateData.contexts;

          // Auto-select first context if none selected and we have contexts
          if (
            !devtoolsStore.state.selectedContext.value &&
            stateData.contexts.length > 0
          ) {
            devtoolsStore.state.selectedContext.value =
              stateData.contexts[0].id;
          }
        }
        if (stateData.transactions) {
          devtoolsStore.state.transactions.value = stateData.transactions;
        }
        if (stateData.selectedContext !== undefined) {
          devtoolsStore.state.selectedContext.value = stateData.selectedContext;
        }
      }
      break;

    case 'TRANSACTION':
      if (message.data && typeof message.data === 'object') {
        const event = message.data as LatticeEvent;
        const transaction: Transaction = {
          id: `tx_${Date.now()}_${Math.random()}`,
          timestamp: event.timestamp || Date.now(),
          contextId: event.contextId,
          type: getEventCategory(event.type),
          eventType: event.type,
          data: event.data as TransactionData,
        };

        // Add transaction (keep last 1000)
        devtoolsStore.state.transactions.value = [
          ...devtoolsStore.state.transactions.value.slice(-999),
          transaction,
        ];

        // Update context metadata
        updateContextFromEvent(event);

        // Process log entries
        console.log('About to process log entry for:', event.type);
        processLogEntry(event);
      }
      break;
  }
}

function getEventCategory(
  eventType: string
): 'signal' | 'computed' | 'effect' | 'batch' | 'selector' {
  if (eventType.startsWith('SIGNAL_')) return 'signal';
  if (eventType.startsWith('COMPUTED_')) return 'computed';
  if (eventType.startsWith('EFFECT_')) return 'effect';
  if (eventType.startsWith('SELECTOR_')) return 'selector';
  return 'batch';
}

interface LatticeEvent {
  type: string;
  contextId: string;
  timestamp?: number;
  data?: unknown;
}

function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsStore.state.contexts.value];
  const contextIndex = contexts.findIndex((c) => c.id === event.contextId);

  if (event.type === 'CONTEXT_CREATED' && contextIndex === -1) {
    const contextData = event.data as ContextCreatedData | undefined;
    contexts.push({
      id: event.contextId,
      name: contextData?.name || `Context ${event.contextId}`,
      signalCount: 0,
      computedCount: 0,
      effectCount: 0,
      signals: [],
      computeds: [],
      effects: [],
    });

    // Auto-select first context if none selected
    if (!devtoolsStore.state.selectedContext.value && contexts.length === 1) {
      devtoolsStore.state.selectedContext.value = event.contextId;
    }
  } else if (contextIndex !== -1) {
    const context = { ...contexts[contextIndex] };

    console.log('updateContextFromEvent processing:', event.type);

    switch (event.type) {
      case 'SIGNAL_CREATED': {
        const signalData = event.data as SignalCreatedEventData;
        context.signalCount++;
        context.signals.push({
          id: signalData.id,
          name: signalData.name,
          value: signalData.initialValue,
          lastUpdated: event.timestamp || Date.now(),
        });

        // Add to dependency graph
        const graph = devtoolsStore.state.dependencyGraph.value;
        graph.nodes.set(signalData.id, {
          id: signalData.id,
          type: 'signal',
          name: signalData.name,
          value: signalData.initialValue,
          isActive: true,
          isOutdated: false,
          hasSubscribers: false,
        });
        devtoolsStore.state.dependencyGraph.value = { ...graph };
        break;
      }

      case 'SIGNAL_WRITE': {
        const writeData = event.data as SignalWriteEventData;
        // Ensure signals array exists
        if (!context.signals) {
          context.signals = [];
        }
        const signalIndex = context.signals.findIndex(
          (s) => s.id === writeData.id
        );
        if (signalIndex !== -1) {
          context.signals[signalIndex] = {
            ...context.signals[signalIndex],
            value: writeData.newValue,
            lastUpdated: event.timestamp || Date.now(),
          };
        } else {
          // Signal doesn't exist yet, create it
          context.signals.push({
            id: writeData.id,
            name: writeData.name,
            value: writeData.newValue,
            lastUpdated: event.timestamp || Date.now(),
          });
          context.signalCount++;
        }
        break;
      }

      case 'COMPUTED_CREATED': {
        const computedData = event.data as ComputedCreatedEventData;
        context.computedCount++;
        context.computeds.push({
          id: computedData.id,
          name: computedData.name,
          value: undefined,
          dependencies: [],
          lastComputed: 0,
        });

        // Add to dependency graph
        const graph = devtoolsStore.state.dependencyGraph.value;
        graph.nodes.set(computedData.id, {
          id: computedData.id,
          type: 'computed',
          name: computedData.name,
          value: undefined,
          isActive: true,
          isOutdated: false,
          hasSubscribers: false,
        });
        devtoolsStore.state.dependencyGraph.value = { ...graph };
        break;
      }

      case 'EFFECT_CREATED': {
        const effectData = event.data as EffectCreatedEventData;
        context.effectCount++;
        context.effects.push({
          id: effectData.id,
          name: effectData.name,
          isActive: true,
          lastRun: 0,
        });

        // Add to dependency graph
        const graph = devtoolsStore.state.dependencyGraph.value;
        graph.nodes.set(effectData.id, {
          id: effectData.id,
          type: 'effect',
          name: effectData.name,
          value: undefined,
          isActive: true,
          isOutdated: false,
          hasSubscribers: false,
        });
        devtoolsStore.state.dependencyGraph.value = { ...graph };
        break;
      }

      case 'DEPENDENCY_UPDATE': {
        const depData = event.data as DependencyUpdateData;
        updateDependencyGraph(depData);
        break;
      }

      case 'SELECTOR_CREATED': {
        const selectorData = event.data as SelectorCreatedEventData;
        
        // Add to dependency graph
        const graph = devtoolsStore.state.dependencyGraph.value;
        graph.nodes.set(selectorData.id, {
          id: selectorData.id,
          type: 'selector',
          name: selectorData.selector,
          value: undefined, // Selectors don't store values
          isActive: true,
          isOutdated: false,
          hasSubscribers: false,
        });
        
        // Add edge from source to selector
        if (!graph.edges.has(selectorData.sourceId)) {
          graph.edges.set(selectorData.sourceId, new Set());
        }
        graph.edges.get(selectorData.sourceId)!.add(selectorData.id);
        
        // Add reverse edge
        if (!graph.reverseEdges.has(selectorData.id)) {
          graph.reverseEdges.set(selectorData.id, new Set());
        }
        graph.reverseEdges.get(selectorData.id)!.add(selectorData.sourceId);
        
        devtoolsStore.state.dependencyGraph.value = { ...graph };
        break;
      }

      case 'GRAPH_SNAPSHOT': {
        const snapshotData = event.data as GraphSnapshotData;
        updateGraphSnapshot(snapshotData, event.timestamp || Date.now());
        break;
      }
    }

    contexts[contextIndex] = context;
  }

  devtoolsStore.state.contexts.value = contexts;
}

function updateDependencyGraph(data: DependencyUpdateData) {
  const graph = devtoolsStore.state.dependencyGraph.value;

  // Update node - preserve existing name if available
  const existingNode = graph.nodes.get(data.id);
  if (existingNode) {
    // Update existing node
    existingNode.value = data.value;
    existingNode.hasSubscribers = data.subscribers.length > 0;
  } else {
    // Create new node if it doesn't exist (shouldn't happen if creation events are working)
    graph.nodes.set(data.id, {
      id: data.id,
      type: data.type,
      name: undefined,
      value: data.value,
      isActive: true,
      isOutdated: false,
      hasSubscribers: data.subscribers.length > 0,
    });
  }

  // Clear existing edges for this node
  graph.edges.delete(data.id);
  graph.reverseEdges.delete(data.id);

  // Update edges correctly: each dependency should have an edge TO this node
  data.dependencies.forEach((dep) => {
    if (!graph.edges.has(dep.id)) {
      graph.edges.set(dep.id, new Set());
    }
    graph.edges.get(dep.id)!.add(data.id);
  });

  // Update reverse edges: this node has edges TO each subscriber
  data.subscribers.forEach((sub) => {
    if (!graph.reverseEdges.has(data.id)) {
      graph.reverseEdges.set(data.id, new Set());
    }
    graph.reverseEdges.get(data.id)!.add(sub.id);
  });

  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}

function updateGraphSnapshot(data: GraphSnapshotData, timestamp: number) {
  const graph = devtoolsStore.state.dependencyGraph.value;

  // Clear and rebuild graph from snapshot
  graph.nodes.clear();
  graph.edges.clear();
  graph.reverseEdges.clear();

  // Add all nodes
  data.nodes.forEach((node) => {
    graph.nodes.set(node.id, node);
  });

  // Add all edges
  data.edges.forEach((edge) => {
    if (!graph.edges.has(edge.source)) {
      graph.edges.set(edge.source, new Set());
    }
    graph.edges.get(edge.source)!.add(edge.target);

    if (!graph.reverseEdges.has(edge.target)) {
      graph.reverseEdges.set(edge.target, new Set());
    }
    graph.reverseEdges.get(edge.target)!.add(edge.source);
  });

  // Update last snapshot
  devtoolsStore.state.lastSnapshot.value = {
    timestamp,
    nodes: data.nodes,
    edges: data.edges,
  };

  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}

// Track execution state for log processing
interface ExecutionState {
  activeEffects: Map<string, { startTime: number; triggeredBy: string[] }>;
  activeComputeds: Map<
    string,
    { startTime: number; triggeredBy: string[]; oldValue?: unknown }
  >;
  recentWrites: Map<string, { timestamp: number; nodeId: string }>;
  currentLevel: number;
}

const executionState: ExecutionState = {
  activeEffects: new Map(),
  activeComputeds: new Map(),
  recentWrites: new Map(),
  currentLevel: 0,
};

function processLogEntry(event: LatticeEvent) {
  const timestamp = event.timestamp || Date.now();
  const graph = devtoolsStore.state.dependencyGraph.value;

  switch (event.type) {
    case 'SIGNAL_WRITE': {
      console.log('Processing SIGNAL_WRITE event');
      const data = event.data as SignalWriteData;
      const node = graph.nodes.get(data.id);

      // Find all dependencies that will be triggered
      const triggeredDeps: string[] = [];
      const subscribers = graph.edges.get(data.id) || new Set();
      subscribers.forEach((subId) => triggeredDeps.push(subId));

      // Track recent write for causality
      executionState.recentWrites.set(data.id, { timestamp, nodeId: data.id });

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

      // Keep last 1000 log entries
      devtoolsStore.state.logEntries.value = [
        ...devtoolsStore.state.logEntries.value.slice(-999),
        logEntry,
      ];
      break;
    }

    case 'SIGNAL_READ': {
      const data = event.data as SignalReadData;
      if (data.internal) return; // Skip internal reads

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

      devtoolsStore.state.logEntries.value = [
        ...devtoolsStore.state.logEntries.value.slice(-999),
        logEntry,
      ];
      break;
    }

    case 'COMPUTED_START': {
      const data = event.data as NamedItemData;
      const node = graph.nodes.get(data.id);

      // Determine what triggered this computed
      const triggeredBy: string[] = [];
      const recentWrite = findRecentTrigger(data.id);
      if (recentWrite) {
        triggeredBy.push(recentWrite);
      }

      executionState.activeComputeds.set(data.id, {
        startTime: timestamp,
        triggeredBy,
        oldValue: node?.value,
      });

      const logEntry: LogEntry = {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp,
        type: 'computed-run',
        level: executionState.currentLevel,
        nodeId: data.id,
        nodeName: data.name || node?.name,
        contextId: event.contextId,
        details: {
          triggeredBy,
        } as ComputedRunLogDetails,
      };

      executionState.currentLevel++;

      devtoolsStore.state.logEntries.value = [
        ...devtoolsStore.state.logEntries.value.slice(-999),
        logEntry,
      ];
      break;
    }

    case 'COMPUTED_END': {
      const data = event.data as {
        id: string;
        name?: string;
        duration?: number;
        value?: unknown;
      };
      const activeComputed = executionState.activeComputeds.get(data.id);
      const node = graph.nodes.get(data.id);

      if (activeComputed) {
        executionState.activeComputeds.delete(data.id);
        executionState.currentLevel = Math.max(
          0,
          executionState.currentLevel - 1
        );

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

        devtoolsStore.state.logEntries.value = [
          ...devtoolsStore.state.logEntries.value,
          logEntry,
        ];
      }
      break;
    }

    case 'EFFECT_START': {
      const data = event.data as NamedItemData;
      const node = graph.nodes.get(data.id);

      // Determine what triggered this effect
      const triggeredBy: string[] = [];
      const recentWrite = findRecentTrigger(data.id);
      if (recentWrite) {
        triggeredBy.push(recentWrite);
      }

      executionState.activeEffects.set(data.id, {
        startTime: timestamp,
        triggeredBy,
      });

      const logEntry: LogEntry = {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp,
        type: 'effect-run',
        level: executionState.currentLevel,
        nodeId: data.id,
        nodeName: data.name || node?.name,
        contextId: event.contextId,
        details: {
          triggeredBy,
        } as EffectRunLogDetails,
      };

      executionState.currentLevel++;

      devtoolsStore.state.logEntries.value = [
        ...devtoolsStore.state.logEntries.value.slice(-999),
        logEntry,
      ];
      break;
    }

    case 'EFFECT_END': {
      const data = event.data as {
        id: string;
        name?: string;
        duration?: number;
      };
      const activeEffect = executionState.activeEffects.get(data.id);
      const node = graph.nodes.get(data.id);

      if (activeEffect) {
        executionState.activeEffects.delete(data.id);
        executionState.currentLevel = Math.max(
          0,
          executionState.currentLevel - 1
        );

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

        devtoolsStore.state.logEntries.value = [
          ...devtoolsStore.state.logEntries.value,
          logEntry,
        ];
      }
      break;
    }

    case 'SELECTOR_CREATED': {
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

      devtoolsStore.state.logEntries.value = [
        ...devtoolsStore.state.logEntries.value.slice(-999),
        logEntry,
      ];
      break;
    }
  }
}

function findRecentTrigger(nodeId: string): string | null {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const now = Date.now();

  // Check direct dependencies
  const dependencies = graph.reverseEdges.get(nodeId) || new Set();

  let mostRecentWrite: { nodeId: string; timestamp: number } | undefined;

  dependencies.forEach((depId) => {
    const write = executionState.recentWrites.get(depId);
    if (write && now - write.timestamp < 100) {
      // Within 100ms
      if (!mostRecentWrite || write.timestamp > mostRecentWrite.timestamp) {
        mostRecentWrite = write;
      }
    }
  });

  return mostRecentWrite ? mostRecentWrite.nodeId : null;
}

// Removed time travel functionality

// Export context for disposal
export const devtoolsLatticeContext = devtoolsContext;
