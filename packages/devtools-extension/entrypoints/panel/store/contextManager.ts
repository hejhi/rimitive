import { devtoolsState } from './devtoolsCtx';
import { ContextInfo, ResourceEventData } from './types';
import { LatticeEvent } from './messageHandler';
import { addNodeToGraph, scheduleBatchUpdate } from './dependencyGraph';

export function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsState.contexts.value];
  const contextIndex = contexts.findIndex((c) => c.id === event.contextId);

  if (event.type === 'CONTEXT_CREATED' && contextIndex === -1) {
    handleContextCreated(contexts, event);
  } else if (contextIndex !== -1) {
    const context = contexts[contextIndex];
    handleResourceEvent(context, event);
  }

  devtoolsState.contexts.value = contexts;
}

function handleContextCreated(contexts: ContextInfo[], event: LatticeEvent) {
  const data = event.data as { name?: string };
  contexts.push({
    id: event.contextId,
    name: data.name || 'Default',
    created: Date.now(),
    resourceCounts: {},
  });
}

function handleResourceEvent(context: ContextInfo, event: LatticeEvent) {
  const eventData = event.data as ResourceEventData;
  
  // The instrumentation API provides the resource type in the data
  // For resource creation events
  if (event.type.endsWith('_CREATED') && eventData.id) {
    // Get resource type from data or derive from event type
    const resourceType = eventData.type || deriveResourceType(event.type);
    
    // Update counts
    if (!context.resourceCounts) {
      context.resourceCounts = {};
    }
    context.resourceCounts[resourceType] = (context.resourceCounts[resourceType] || 0) + 1;
    
    // Add to dependency graph
    addNodeToGraph(eventData.id, {
      type: resourceType,
      name: eventData.name,
      value: eventData.value || eventData.initialValue,
    });
  } 
  // For value updates
  else if ((event.type.endsWith('_WRITE') || event.type.endsWith('_UPDATE')) && eventData.id) {
    scheduleBatchUpdate(() => {
      const graph = devtoolsState.dependencyGraph.value;
      const node = graph.nodes.get(eventData.id);
      
      if (node) {
        if ('newValue' in eventData) {
          node.value = eventData.newValue;
        } else if ('value' in eventData) {
          node.value = eventData.value;
        }
      }
    });
  }
}

// Derive resource type from event type as fallback
function deriveResourceType(eventType: string): string {
  // Remove the action suffix to get the resource type
  const parts = eventType.split('_');
  if (parts.length > 1) {
    parts.pop(); // Remove action (CREATED, WRITE, etc.)
    return parts.join('_').toLowerCase();
  }
  return 'unknown';
}