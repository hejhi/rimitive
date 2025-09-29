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
interface StackNode {
  node: DerivedNode;
  prev: StackNode | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

// Map to store triggering versions during pull phase
type TriggeringVersions = Map<FromNode, number>;

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
    const triggeringVersions: TriggeringVersions = new Map();

    traversal: do {
      if (current.status === STATUS_CLEAN) {
        if (stackHead === undefined) break;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      let dep: Dependency | undefined = current.dependencies;

      if (dep === undefined) {
        const prevValue = current.value;
        // No dependencies means no triggering versions needed
        current.value = track(ctx, current, current.compute);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) {
          current.version++;
        }

        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue;
      }

      // Phase 1: Pull ALL pending dependencies first
      do {
        const producer: FromNode = dep.producer;

        if ('compute' in producer && producer.status === STATUS_PENDING) {
          // Found a pending dependency - must pull it first
          stackHead = { node: current, prev: stackHead };
          current = producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      } while (dep);

      // Phase 2: After all pending are resolved, check for dirty derived nodes
      dep = current.dependencies;

      while (dep) {
        const producer: FromNode = dep.producer;

        // If a dependency is a dirty derived node, it needs to be pulled first
        if ('compute' in producer && producer.status === STATUS_DIRTY) {
          stackHead = { node: current, prev: stackHead };
          current = producer;
          continue traversal;
        }

        dep = dep.nextDependency;
      }

      // Phase 3: Check if any dependency values have changed
      dep = current.dependencies;
      let hasValueChange = false;

      // Clear triggering versions for this node
      triggeringVersions.clear();

      while (dep) {
        const producer: FromNode = dep.producer;

        // Handle DIRTY signals: increment version and mark clean
        // This happens during pull phase, not write phase
        if (producer.status === STATUS_DIRTY) {
          producer.version++;
          producer.status = STATUS_CLEAN;
        }

        // Check if this dependency's value has changed since last time we checked
        // by comparing the version we recorded with the current version
        const versionChanged = dep.producerVersion !== producer.version;
        if (versionChanged) {
          // console.log(`  Dependency changed: version: ${dep.producerVersion} -> ${producer.version}`);
          hasValueChange = true;
        }

        // Store the version that triggered this computation
        // This is the version we had when we decided to recompute
        triggeringVersions.set(producer, dep.producerVersion);

        dep = dep.nextDependency;
      }

      // Phase 4: Recompute only if any dependency value changed
      // Special case: If version is 0, this is the first computation with dependencies
      if (hasValueChange || current.version === 0) {
        const prevValue = current.value;
        current.value = track(ctx, current, current.compute, triggeringVersions);

        // Only increment version if the value actually changed
        if (prevValue !== current.value) {
          current.version++;
        }

        // After computing, the node is up-to-date
        current.status = STATUS_CLEAN;

        if (stackHead === undefined) break traversal;
        current = stackHead.node;
        stackHead = stackHead.prev;
        continue traversal;
      }

      // All dependencies are clean and node is already computed
      current.status = STATUS_CLEAN;

      if (stackHead === undefined) break;
      current = stackHead.node;
      stackHead = stackHead.prev;
    } while (current);
  };

  return { pullUpdates };
}