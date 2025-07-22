import { devtoolsState } from './devtoolsCtx';
import { ContextInfo, ResourceEventData } from './types';
import { LatticeEvent } from './messageHandler';
import { addNodeToGraph, scheduleBatchUpdate } from './dependencyGraph';

export function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsState.contexts.value];
  let contextIndex = contexts.findIndex((c) => c.id === event.contextId);

  // Create context if it doesn't exist yet
  if (contextIndex === -1 && event.contextId) {
    const contextNumber = contexts.length + 1;
    contexts.push({
      id: event.contextId,
      name: `Context ${contextNumber}`,
      created: Date.now(),
      resourceCounts: {},
    });
    contextIndex = contexts.length - 1;
  }

  // Handle resource events for existing contexts
  if (contextIndex !== -1 && event.type !== 'CONTEXT_CREATED') {
    const context = contexts[contextIndex];
    handleResourceEvent(context, event);
  }

  devtoolsState.contexts.value = contexts;
  
  // Auto-select first context if none selected
  if (!devtoolsState.selectedContext.value && contexts.length > 0) {
    devtoolsState.selectedContext.value = contexts[0].id;
  }
}

function handleResourceEvent(context: ContextInfo, event: LatticeEvent) {
  const eventData = event.data as ResourceEventData;
  
  // Handle resource creation events and update counts
  if (event.type.endsWith('_CREATED') && eventData.id) {
    // Get resource type from the data or derive it from event type
    const resourceType = eventData.type || deriveResourceType(event.type);
    
    // Update resource count
    if (!context.resourceCounts[resourceType]) {
      context.resourceCounts[resourceType] = 0;
    }
    context.resourceCounts[resourceType]++;
    
    // Add to dependency graph
    const graph = devtoolsState.dependencyGraph.value;
    if (!graph.nodes.has(eventData.id)) {
      addNodeToGraph(eventData.id, {
        type: resourceType,
        name: eventData.name,
        value: eventData.value || eventData.initialValue,
        contextId: event.contextId,
      });
    }
  } 
  // Handle value updates
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