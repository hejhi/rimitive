import type { DevtoolsState } from './devtoolsBehavior';
import type { RimitiveEvent } from './messageHandler';

/**
 * Create a context updater bound to a specific devtools state instance
 */
export function createContextUpdater(devtools: DevtoolsState) {
  return function updateContextFromEvent(event: RimitiveEvent) {
    const contexts = [...devtools.contexts.peek()];
    let contextIndex = contexts.findIndex((c) => c.id === event.contextId);

    // Create context if it doesn't exist yet
    if (contextIndex === -1 && event.contextId) {
      const contextNumber = contexts.length + 1;
      contexts.push({
        id: event.contextId,
        name: `Service ${contextNumber}`,
        created: Date.now(),
      });
      contextIndex = contexts.length - 1;
    }

    devtools.contexts(contexts);
  };
}
