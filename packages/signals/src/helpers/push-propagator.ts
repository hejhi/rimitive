import type { Dependency } from '../types';
import { CONSTANTS, createFlagManager } from '../constants';

const { STATUS_INVALIDATED, MASK_STATUS_SKIP_NODE } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PushPropagator {
  pushUpdates: (from: Dependency) => void;
}

const { hasAnyOf, setStatus } = createFlagManager();

export function createPushPropagator(): PushPropagator {
  // Iterative DFS on push with an explicit stack, optimized with intrusive linked lists
  const pushUpdates = (dependents: Dependency): void => {
    let dependencyStack: Stack<Dependency> | undefined;
    let currentDependency: Dependency | undefined = dependents;

    do {
      const consumerNode = currentDependency.consumer;
      const consumerNodeFlags = consumerNode.flags;

      if (
        hasAnyOf(consumerNodeFlags, MASK_STATUS_SKIP_NODE | STATUS_INVALIDATED)
      ) {
        currentDependency = currentDependency.nextDependent;
        continue;
      }

      consumerNode.flags = setStatus(consumerNodeFlags, STATUS_INVALIDATED);

      // Fast path: if node has _notify, it's an effect - schedule it directly
      // This avoids method calls and property lookups
      if ('notify' in consumerNode) consumerNode.notify(consumerNode);

      if ('dependents' in consumerNode) {
        const consumerDependents = consumerNode.dependents;

        // If a consumer has dependents, continue depth-first traversal
        if (consumerDependents) {
          // Save sibling dependents (other children of the same consumer-producer) on the stack
          // to process after completing the current path
          const siblingDep = currentDependency.nextDependent;

          if (siblingDep) dependencyStack = { value: siblingDep, prev: dependencyStack };

          currentDependency = consumerDependents;
          continue;
        }
      }

      // No further dependents, shift to sibling consumer and go deep
      currentDependency = currentDependency.nextDependent;

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