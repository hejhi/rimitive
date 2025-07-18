import { devtoolsStore } from './devtoolsCtx';
import {
  ContextInfo,
  SignalCreatedData,
  SignalWriteData,
  SelectorCreatedEventData,
} from './types';
import { LatticeEvent } from './messageHandler';
import { addNodeToGraph, scheduleBatchUpdate } from './dependencyGraph';

interface ContextCreatedData {
  name?: string;
}

interface ComputedCreatedData {
  id: string;
  name?: string;
}

interface EffectCreatedData {
  id: string;
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
  } else if (event.type !== 'CONTEXT_CREATED' && contextIndex === -1) {
    // Event for a context we don't know about - ignore it
    // This can happen if events arrive before STATE_UPDATE
    return;
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
  });

  // Auto-select first context if none selected
  if (!devtoolsStore.state.selectedContext.value && contexts.length === 1) {
    devtoolsStore.state.selectedContext.value = event.contextId;
  }
}

function handleContextEvent(context: ContextInfo, event: LatticeEvent) {
  switch (event.type) {
    case 'SIGNAL_CREATED':
      handleSignalCreated(context, event);
      break;
    case 'SIGNAL_WRITE':
      handleSignalWrite(event);
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
  const signalData = event.data as SignalCreatedData;

  context.signalCount++;

  addNodeToGraph(signalData.id, {
    type: 'signal',
    name: signalData.name,
    value: signalData.initialValue,
  });
}

function handleSignalWrite(event: LatticeEvent) {
  const writeData = event.data as SignalWriteData;

  scheduleBatchUpdate(() => {
    const graph = devtoolsStore.state.dependencyGraph.value;
    const node = graph.nodes.get(writeData.id);

    if (node) {
      node.value = writeData.newValue;
    }
  });
}

function handleComputedCreated(context: ContextInfo, event: LatticeEvent) {
  const computedData = event.data as ComputedCreatedData;

  context.computedCount++;

  addNodeToGraph(computedData.id, {
    type: 'computed',
    name: computedData.name,
    value: undefined,
  });
}

function handleEffectCreated(context: ContextInfo, event: LatticeEvent) {
  const effectData = event.data as EffectCreatedData;

  context.effectCount++;

  addNodeToGraph(effectData.id, {
    type: 'effect',
    name: effectData.name,
    value: undefined,
  });
}

function handleSelectorCreated(event: LatticeEvent) {
  const selectorData = event.data as SelectorCreatedEventData;

  // Add selector node
  addNodeToGraph(selectorData.id, {
    type: 'selector',
    name: selectorData.selector,
    value: undefined,
  });

  // Add edges in a batched update
  scheduleBatchUpdate(() => {
    const graph = devtoolsStore.state.dependencyGraph.value;

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
  });
}
