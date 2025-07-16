import { devtoolsStore } from '../devtoolsCtx';
import { ContextInfo } from '../types';
import { LatticeEvent } from './messageHandler';
import { addNodeToGraph } from './dependencyGraph';
import { 
  SignalCreatedEventData, 
  SignalWriteEventData, 
  ComputedCreatedEventData, 
  EffectCreatedEventData,
  SelectorCreatedEventData 
} from './eventTypes';

interface ContextCreatedData {
  name?: string;
}

export function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsStore.state.contexts.value];
  const contextIndex = contexts.findIndex((c) => c.id === event.contextId);

  if (event.type === 'CONTEXT_CREATED' && contextIndex === -1) {
    handleContextCreated(contexts, event);
  } else if (contextIndex !== -1) {
    const context = { ...contexts[contextIndex] };
    handleContextEvent(context, event);
    contexts[contextIndex] = context;
  }

  devtoolsStore.state.contexts.value = contexts;
}

function handleContextCreated(contexts: ContextInfo[], event: LatticeEvent) {
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
}

function handleContextEvent(context: ContextInfo, event: LatticeEvent) {
  console.log('updateContextFromEvent processing:', event.type);

  switch (event.type) {
    case 'SIGNAL_CREATED':
      handleSignalCreated(context, event);
      break;
    case 'SIGNAL_WRITE':
      handleSignalWrite(context, event);
      break;
    case 'COMPUTED_CREATED':
      handleComputedCreated(context, event);
      break;
    case 'EFFECT_CREATED':
      handleEffectCreated(context, event);
      break;
    case 'SELECTOR_CREATED':
      handleSelectorCreated(event);
      break;
  }
}

function handleSignalCreated(context: ContextInfo, event: LatticeEvent) {
  const signalData = event.data as SignalCreatedEventData;
  
  context.signalCount++;
  context.signals.push({
    id: signalData.id,
    name: signalData.name,
    value: signalData.initialValue,
    lastUpdated: event.timestamp || Date.now(),
  });

  addNodeToGraph(signalData.id, {
    type: 'signal',
    name: signalData.name,
    value: signalData.initialValue,
  });
}

function handleSignalWrite(context: ContextInfo, event: LatticeEvent) {
  const writeData = event.data as SignalWriteEventData;
  
  if (!context.signals) {
    context.signals = [];
  }
  
  const signalIndex = context.signals.findIndex((s) => s.id === writeData.id);
  
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
}

function handleComputedCreated(context: ContextInfo, event: LatticeEvent) {
  const computedData = event.data as ComputedCreatedEventData;
  
  context.computedCount++;
  context.computeds.push({
    id: computedData.id,
    name: computedData.name,
    value: undefined,
    dependencies: [],
    lastComputed: 0,
  });

  addNodeToGraph(computedData.id, {
    type: 'computed',
    name: computedData.name,
    value: undefined,
  });
}

function handleEffectCreated(context: ContextInfo, event: LatticeEvent) {
  const effectData = event.data as EffectCreatedEventData;
  
  context.effectCount++;
  context.effects.push({
    id: effectData.id,
    name: effectData.name,
    isActive: true,
    lastRun: 0,
  });

  addNodeToGraph(effectData.id, {
    type: 'effect',
    name: effectData.name,
    value: undefined,
  });
}

function handleSelectorCreated(event: LatticeEvent) {
  const selectorData = event.data as SelectorCreatedEventData;
  const graph = devtoolsStore.state.dependencyGraph.value;
  
  // Add selector node
  addNodeToGraph(selectorData.id, {
    type: 'selector',
    name: selectorData.selector,
    value: undefined,
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
}