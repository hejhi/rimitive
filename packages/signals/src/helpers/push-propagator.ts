import type { Dependency } from '../types';
import { CONSTANTS } from '../constants';

const { STATUS_PENDING, STATUS_DISPOSED } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PushPropagator {
  pushUpdates: (from: Dependency) => void;
}

// Flag operations are now done directly with bitwise operators for performance

export function createPushPropagator(): PushPropagator {
  // Iterative DFS on push with an explicit stack, optimized with intrusive linked lists
  const pushUpdates = (subscribers: Dependency): void => {
    let dependencyStack: Stack<Dependency> | undefined;
    let currentDependency: Dependency | undefined = subscribers;

    do {
      const consumerNode = currentDependency.consumer;
      const consumerNodeFlags = consumerNode.flags;

      // Batch check: combine skip conditions
      if (consumerNodeFlags & (STATUS_DISPOSED | STATUS_PENDING)) {
        currentDependency = currentDependency.nextConsumer;
        continue;
      }

      // Batch operation: directly set status without helper function
      consumerNode.flags = STATUS_PENDING;

      // Fast path: if node has _notify, it's an effect - schedule it directly
      // This avoids method calls and property lookups
      if ('notify' in consumerNode) consumerNode.notify(consumerNode);

      if ('subscribers' in consumerNode) {
        const consumerSubscribers = consumerNode.subscribers;

        // If a consumer has subscribers, continue depth-first traversal
        if (consumerSubscribers) {
          // Save sibling subscribers (other children of the same consumer-producer) on the stack
          // to process after completing the current path
          const siblingDep = currentDependency.nextConsumer;

          if (siblingDep)
            dependencyStack = { value: siblingDep, prev: dependencyStack };

          currentDependency = consumerSubscribers;
          continue;
        }
      }

      // No further subscribers, shift to sibling consumer and go deep
      currentDependency = currentDependency.nextConsumer;

      if (currentDependency || !dependencyStack) continue;

      // No deeper dependencies, rinse and repeat with sibling dependencies on the stack
      while (!currentDependency && dependencyStack) {
        currentDependency = dependencyStack.value;
        dependencyStack = dependencyStack.prev; // "Pop" off the stack, working backwards via `prev`
      }
    } while (currentDependency);
  };

  return { pushUpdates };
}