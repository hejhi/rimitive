import { devtoolsState } from './devtoolsCtx';
import { ContextInfo, ResourceEventData } from './types';
import { LatticeEvent } from './messageHandler';

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

function handleResourceEvent(_context: ContextInfo, event: LatticeEvent) {
  // Currently not used, but kept for potential future use
  // Resource events are now handled purely through log entries
  const eventData = event.data as ResourceEventData;
  
  // Could add custom handling here if needed
  void eventData; // Silence unused variable warning
}