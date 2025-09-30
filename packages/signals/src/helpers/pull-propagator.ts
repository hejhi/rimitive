import type { Dependency, DerivedNode, FromNode, ToNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING, STATUS_PRISTINE, NEEDS_PULL } = CONSTANTS;

// Minimal 3-field stack with temp state bits
interface StackNode {
  dep: Dependency;  // The pulled dependency (consumer = node, check if changed on pop)
  prev: StackNode | undefined;
  bits: number;     // Temp state: parent's needsRecompute + child changed flag
}

// Bit flags for StackNode.bits field
const PARENT_RECOMPUTE_BIT = 1 << 0; // Parent's needsRecompute state
const CHILD_CHANGED_BIT = 1 << 1;     // Child value changed during pull
const FORCE_RECOMPUTE = STATUS_DIRTY | STATUS_PRISTINE;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

// Upgrade siblings to DIRTY
const shallowPropagate = (current: FromNode) => {
  let sub = current.subscribers;

  if (sub) {
    do {
      const consumer = sub.consumer;
      if (consumer.status === STATUS_PENDING) consumer.status = STATUS_DIRTY;
      sub = sub.nextConsumer;
    } while (sub);
  }
};

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
    let needsRecompute = false;  // Track if any dependency changed

    traversal: do {
      const status = current.status;

      if (status === STATUS_CLEAN) {
        if (stackHead === undefined) break;

        // Reconstruct from minimal stack: consumer MUST be DerivedNode
        // because we only push to stack when pulling a derived dependency
        const stackNode = stackHead;
        const stackDep = stackNode.dep;
        const stackBits = stackNode.bits;

        current = stackDep.consumer;
        dep = stackDep.nextDependency;
        stackHead = stackNode.prev;

        // Restore state from stack bits
        needsRecompute = (stackBits & PARENT_RECOMPUTE_BIT) !== 0;
        const depChanged = (stackBits & CHILD_CHANGED_BIT) !== 0;

        // Check if pulled dep changed (returned via stack bits)
        if (depChanged) needsRecompute = true;
        continue;
      }

      // Initialize dependency iteration for this node (only if not resuming from stack pop)
      if (dep === undefined) dep = current.dependencies;

      // If node is DIRTY or PRISTINE, it needs recompute
      // DIRTY: sibling detected a change via upgradePendingToDirty
      // PRISTINE: never computed before
      if (status & FORCE_RECOMPUTE) needsRecompute = true;

      // OPTIMIZED: Single pass over dependencies - only run if node has dependencies
      if (dep !== undefined) {
        do {
          const producer: FromNode = dep.producer;
          const status = producer.status;

          // Check if this is a derived node that needs pulling
          if (status & NEEDS_PULL) {
            if ('compute' in producer) {
              // Push to stack with parent's recompute state saved in bits
              const bits = needsRecompute ? PARENT_RECOMPUTE_BIT : 0;
              stackHead = { dep, prev: stackHead, bits };

              current = producer;
              needsRecompute = false; // Reset for new node
              dep = undefined; // Will be initialized to current.dependencies on next iteration

              continue traversal;
            }

            if (status === STATUS_DIRTY) {
              // Signal is dirty - it has changed
              needsRecompute = true;
              shallowPropagate(producer);

              producer.status = STATUS_CLEAN;
            }
          }

          dep = dep.nextDependency;
        } while (dep);
      }

      // All dependencies pulled - handle computation for producer nodes
      // Compute if hasValueChange is true (set by DIRTY, PRISTINE, or dependency changes)
      if ('value' in current && needsRecompute) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute);

        // Only propagate if the value actually changed
        if (prevValue !== current.value) {
          shallowPropagate(current);
          // Mark this node as changed in stack bits if we're in a recursive pull
          if (stackHead) stackHead.bits |= CHILD_CHANGED_BIT;
        }
      }

      // else: pure consumer node (ScheduledNode) - no computation, just mark clean
      // After computing or skipping, the node is up-to-date
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;

      // Reconstruct from minimal stack: consumer MUST be DerivedNode
      const stackNode = stackHead;
      const stackDep = stackNode.dep;
      const stackBits = stackNode.bits;

      current = stackDep.consumer;
      dep = stackDep.nextDependency;
      stackHead = stackNode.prev;

      // Restore state from stack bits
      needsRecompute = (stackBits & PARENT_RECOMPUTE_BIT) !== 0;
      const depChanged = (stackBits & CHILD_CHANGED_BIT) !== 0;

      // Check if pulled dep changed (returned via stack bits)
      if (depChanged) needsRecompute = true;
    } while (current);
  };

  return { pullUpdates };
}