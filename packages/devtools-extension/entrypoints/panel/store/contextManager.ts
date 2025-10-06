import { devtoolsState } from './devtoolsCtx';
import { LatticeEvent } from './messageHandler';

export function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsState.contexts()];
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

  devtoolsState.contexts(contexts);
}
