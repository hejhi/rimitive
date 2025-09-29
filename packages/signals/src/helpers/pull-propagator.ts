import type { Dependency, DerivedNode, FromNode, ToNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

// Minimal 2-field stack - match alien-signals design
interface StackNode {
  dep: Dependency;  // The pulled dependency (consumer = node, check versions on pop)
  prev: StackNode | undefined;
}

// Use high bit of status to temporarily store hasValueChange during traversal
// status uses bits 0-1 (values 0-3), bit 31 is free for temp state
const HAS_CHANGE_BIT = 1 << 31;

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
    let current: ToNode | undefined = rootNode;
    let stackHead: StackNode | undefined;
    let dep: Dependency | undefined;
    let hasValueChange = false;  // Track if any dependency version changed

    traversal: do {
      if (current.status === STATUS_CLEAN) {
        if (stackHead === undefined) break;

        // Reconstruct from minimal stack: consumer MUST be DerivedNode
        // because we only push to stack when pulling a derived dependency
        const stackDep = stackHead.dep;
        current = stackDep.consumer;
        dep = stackDep.nextDependency;
        stackHead = stackHead.prev;

        // Restore accumulated state from status high bit
        hasValueChange = (current.status & HAS_CHANGE_BIT) !== 0;
        current.status &= ~HAS_CHANGE_BIT;  // Clear the temp bit

        // Check if pulled dep itself changed
        if (stackDep.producerVersion !== stackDep.producer.version) {
          hasValueChange = true;
        }
        continue;
      }

      // Initialize dependency iteration for this node (only if not resuming from stack pop)
      if (dep === undefined) {
        dep = current.dependencies;
      }

      // Handle nodes with no dependencies (compute immediately)
      if (dep === undefined && 'value' in current) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) current.version++;

        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break;

        // Reconstruct from minimal stack: consumer MUST be DerivedNode
        const stackDep = stackHead.dep;
        current = stackDep.consumer;
        dep = stackDep.nextDependency;
        stackHead = stackHead.prev;

        // Restore accumulated state from status high bit
        hasValueChange = (current.status & HAS_CHANGE_BIT) !== 0;
        current.status &= ~HAS_CHANGE_BIT;  // Clear the temp bit

        // Check if pulled dep itself changed
        if (stackDep.producerVersion !== stackDep.producer.version) {
          hasValueChange = true;
        }
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
      if (needsPull && pulledDep) {  // pulledDep must exist if needsPull is set
        // Store accumulated state in node's status high bit (no allocation)
        if (hasValueChange) current.status |= HAS_CHANGE_BIT;

        // Minimal 2-field stack - match alien-signals design
        stackHead = {
          dep: pulledDep,  // Reconstruct everything else on pop
          prev: stackHead
        };
        current = needsPull;
        hasValueChange = false;  // Reset for new node
        dep = undefined;  // Will be initialized to current.dependencies on next iteration
        continue traversal;
      }

      if ('value' in current) {
        // All dependencies pulled, now decide if recompute needed
        // Special case: If version is 0, this is the first computation with dependencies
        if (hasValueChange || current.version === 0) {
          const prevValue = current.value;
          current.value = track(ctx, current, current.compute);
  
          // Only increment version if the value actually changed
          if (prevValue !== current.value) current.version++;
        }
      }

      // After computing or skipping, the node is up-to-date
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;

      // Reconstruct from minimal stack: consumer MUST be DerivedNode
      const stackDep = stackHead.dep;
      current = stackDep.consumer;
      dep = stackDep.nextDependency;
      stackHead = stackHead.prev;

      // Restore accumulated state from status high bit
      hasValueChange = (current.status & HAS_CHANGE_BIT) !== 0;
      current.status &= ~HAS_CHANGE_BIT;  // Clear the temp bit

      // Check if pulled dep itself changed
      if (stackDep.producerVersion !== stackDep.producer.version) {
        hasValueChange = true;
      }
    } while (current);
  };

  return { pullUpdates };
}