import type { Dependency, DerivedNode, FromNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Linked list stack node for memory efficiency
// Tracks both the node and the dependency position to resume from
interface StackNode {
  node: DerivedNode;
  dep: Dependency | undefined;  // Resume iteration from this dependency
  pulledDep: Dependency | undefined;  // The dependency we just pulled (to check version after)
  depStarted: boolean;  // True if we've started iterating dependencies
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
    let depStarted = false;  // Track if we've started iterating dependencies
    let hasValueChange = false;  // Track if any dependency version changed

    traversal: do {
      if (current.status === STATUS_CLEAN) {
        if (stackHead === undefined) break;
        current = stackHead.node;
        dep = stackHead.dep;  // Resume from saved position
        depStarted = stackHead.depStarted;
        hasValueChange = stackHead.hasValueChange;
        // Check if the dependency we just pulled changed
        const pulledDep = stackHead.pulledDep;
        if (pulledDep && pulledDep.producerVersion !== pulledDep.producer.version) {
          hasValueChange = true;
        }
        stackHead = stackHead.prev;
        continue;
      }

      // Initialize dependency iteration if not resuming from stack
      if (!depStarted) {
        dep = current.dependencies;
        depStarted = true;
        hasValueChange = false;  // Reset for new node
      }

      // Handle nodes with no dependencies (compute immediately)
      // Don't confuse this with "finished iterating all dependencies" (dep = undefined after loop)
      if (dep === undefined && current.dependencies === undefined) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) current.version++;

        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break;
        current = stackHead.node;
        dep = stackHead.dep;  // Resume from saved position
        depStarted = stackHead.depStarted;
        hasValueChange = stackHead.hasValueChange;
        const pulledDep = stackHead.pulledDep;
        if (pulledDep && pulledDep.producerVersion !== pulledDep.producer.version) {
          hasValueChange = true;
        }
        stackHead = stackHead.prev;
        continue;
      }

      // OPTIMIZED: Single pass over dependencies
      let needsPull: DerivedNode | undefined;

      while (dep) {
        const producer: FromNode = dep.producer;

        // Check if this is a derived node that needs pulling
        if ('compute' in producer) {
          if (producer.status === STATUS_PENDING || producer.status === STATUS_DIRTY) {
            // Found a dependency that needs pulling
            // Check version BEFORE pulling (producer might be updated during pull)
            if (dep.producerVersion !== producer.version) hasValueChange = true;
            needsPull = producer;
            break;
          }
        } else if (producer.status === STATUS_DIRTY) {
          // Handle dirty signal: increment version in pull phase
          producer.version++;
          producer.status = STATUS_CLEAN;
        }

        // Check for version changes (always do this)
        if (dep.producerVersion !== producer.version) hasValueChange = true;

        dep = dep.nextDependency;
      }

      // If we found a node to pull, do it recursively
      if (needsPull && dep) {  // dep must exist if needsPull is set
        // Save the next dependency position and accumulated state to resume from after recursion
        // Also save the dependency we're about to pull so we can check its version after
        stackHead = {
          node: current,
          dep: dep.nextDependency,
          pulledDep: dep,  // Save this to check version after pull
          depStarted: true,
          hasValueChange,
          prev: stackHead
        };
        current = needsPull;
        dep = undefined;
        depStarted = false;  // Start fresh for the new node
        hasValueChange = false;
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
      depStarted = stackHead.depStarted;
      hasValueChange = stackHead.hasValueChange;
      const pulledDep2 = stackHead.pulledDep;
      if (pulledDep2 && pulledDep2.producerVersion !== pulledDep2.producer.version) {
        hasValueChange = true;
      }
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}