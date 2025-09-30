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

        const status = current.status;

        // Restore accumulated state from status high bit
        hasValueChange = (status & HAS_CHANGE_BIT) !== 0;
        current.status = status & ~HAS_CHANGE_BIT;  // Clear the temp bit

        // Check if pulled dep itself changed
        if (stackDep.producerVersion !== stackDep.producer.version) hasValueChange = true;
        continue;
      }

      // Initialize dependency iteration for this node (only if not resuming from stack pop)
      if (dep === undefined) dep = current.dependencies;

      // OPTIMIZED: Single pass over dependencies - only run if node has dependencies
      if (dep !== undefined) {
        let needsPull: DerivedNode | undefined;
        let pulledDep: Dependency | undefined;

        do {
          const producer: FromNode = dep.producer;
          const status = producer.status;

          // Check if this is a derived node that needs pulling
          if (status === STATUS_PENDING || status === STATUS_DIRTY) {
            if ('compute' in producer) {
              // Found a dependency that needs pulling - save it to check version after
              needsPull = producer;
              pulledDep = dep;
              break;
            }

            if (status === STATUS_DIRTY) {
              // Handle dirty signal: increment version in pull phase
              producer.version++;
              producer.status = STATUS_CLEAN;
            }
          }

          // Check for version changes (only for clean deps - pulled deps checked after return)
          if (dep.producerVersion !== producer.version) hasValueChange = true;

          dep = dep.nextDependency;
        } while (dep);

        // If we found a node to pull, do it recursively
        // pulledDep must exist if needsPull is set
        if (needsPull && pulledDep) {
          // Store accumulated state in node's status high bit (no allocation)
          if (hasValueChange) current.status |= HAS_CHANGE_BIT;

          // Minimal 2-field stack - match alien-signals design
          // Reconstruct everything else on pop
          current = needsPull;
          hasValueChange = false; // Reset for new node
          stackHead = { dep: pulledDep, prev: stackHead };
          dep = undefined; // Will be initialized to current.dependencies on next iteration
          continue traversal;
        }
      }

      // All dependencies pulled - handle computation for producer nodes
      // Compute if: no dependencies OR (has dependencies AND needs update)
      if ('value' in current && (!current.dependencies || hasValueChange || current.version === 0)) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) current.version++;
      }

      // else: pure consumer node (ScheduledNode) - no computation, just mark clean
      // After computing or skipping, the node is up-to-date
      current.status = STATUS_CLEAN;
      
      if (stackHead === undefined) break;

      // Reconstruct from minimal stack: consumer MUST be DerivedNode
      const stackDep = stackHead.dep;

      current = stackDep.consumer;
      dep = stackDep.nextDependency;
      stackHead = stackHead.prev;

      const currStat = current.status;

      // Restore accumulated state from status high bit
      hasValueChange = (currStat & HAS_CHANGE_BIT) !== 0;
      current.status = currStat & ~HAS_CHANGE_BIT;  // Clear the temp bit

      // Check if pulled dep itself changed
      if (stackDep.producerVersion !== stackDep.producer.version) hasValueChange = true;
    } while (current);
  };

  return { pullUpdates };
}