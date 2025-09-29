import type { Dependency, DerivedNode, FromNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Minimal stack node - only store what cannot be reconstructed
// Track version as primitive (4 bytes) rather than full dep reference (8 bytes)
interface StackNode {
  node: DerivedNode;
  dep: Dependency | undefined;  // Resume iteration from this dependency
  pulledDep: Dependency | undefined;  // The dependency we pulled (to check version after)
  hasValueChange: boolean;  // Accumulated value change flag
  prev: StackNode | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

export function createPullPropagator({
  ctx,
  track
}: {
  ctx: GlobalContext,
  track: GraphEdges['track']
}): PullPropagator {
  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: DerivedNode | undefined = rootNode;
    let stackHead: StackNode | undefined;
    let dep: Dependency | undefined;
    let hasValueChange = false;  // Track if any dependency version changed

    traversal: do {
      if (current.status === STATUS_CLEAN) {
        if (stackHead === undefined) break;
        current = stackHead.node;
        dep = stackHead.dep;  // Resume from saved position
        hasValueChange = stackHead.hasValueChange;
        // Check if pulled dependency changed after recursion
        if (stackHead.pulledDep && stackHead.pulledDep.producerVersion !== stackHead.pulledDep.producer.version) {
          hasValueChange = true;
        }
        stackHead = stackHead.prev;
        continue;
      }

      // Initialize dependency iteration for this node (only if not resuming from stack pop)
      if (dep === undefined) {
        dep = current.dependencies;
      }

      // Handle nodes with no dependencies (compute immediately)
      if (dep === undefined) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) current.version++;

        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break;
        current = stackHead.node;
        dep = stackHead.dep;  // Resume from saved position
        hasValueChange = stackHead.hasValueChange;
        // Check if pulled dependency changed after recursion
        if (stackHead.pulledDep && stackHead.pulledDep.producerVersion !== stackHead.pulledDep.producer.version) {
          hasValueChange = true;
        }
        stackHead = stackHead.prev;
        continue;
      }

      // OPTIMIZED: Single pass over dependencies
      let needsPull: DerivedNode | undefined;
      let pulledDep: Dependency | undefined;

      while (dep) {
        const producer: FromNode = dep.producer;

        // Check if this is a derived node that needs pulling
        if ('compute' in producer) {
          if (producer.status === STATUS_PENDING || producer.status === STATUS_DIRTY) {
            // Found a dependency that needs pulling - save it to check version after
            needsPull = producer;
            pulledDep = dep;
            break;
          }
        } else if (producer.status === STATUS_DIRTY) {
          // Handle dirty signal: increment version in pull phase
          producer.version++;
          producer.status = STATUS_CLEAN;
        }

        // Check for version changes (only for clean deps - pulled deps checked after return)
        if (dep.producerVersion !== producer.version) hasValueChange = true;

        dep = dep.nextDependency;
      }

      // If we found a node to pull, do it recursively
      if (needsPull && dep) {  // dep must exist if needsPull is set
        // Minimal stack allocation - only store what we can't reconstruct
        stackHead = {
          node: current,
          dep: dep.nextDependency,  // Resume from here after recursion
          pulledDep,  // Check version after pull
          hasValueChange,  // Accumulated state
          prev: stackHead
        };
        current = needsPull;
        hasValueChange = false;  // Reset for new node
        dep = undefined;  // Will be initialized to current.dependencies on next iteration
        continue traversal;
      }

      // All dependencies pulled, now decide if recompute needed
      // Special case: If version is 0, this is the first computation with dependencies
      if (hasValueChange || current.version === 0) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) current.version++;
      }

      // After computing or skipping, the node is up-to-date
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;
      current = stackHead.node;
      dep = stackHead.dep;  // Resume from saved position
      hasValueChange = stackHead.hasValueChange;
      // Check if pulled dependency changed after recursion
      if (stackHead.pulledDep && stackHead.pulledDep.producerVersion !== stackHead.pulledDep.producer.version) {
        hasValueChange = true;
      }
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}