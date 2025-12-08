import type {
  ProducerNode,
  ConsumerNode,
  ToNode,
  FromNode,
  Dependency,
} from '../types';
import { CONSTANTS } from '../constants';
import { defineModule } from '@lattice/lattice';

const { TYPE_MASK, CLEAN } = CONSTANTS;

// Re-export types for proper type inference
export type { ProducerNode, ConsumerNode, Dependency } from '../types';

/**
 * Consumer tracking state - tracks the currently active consumer during reactive reads
 */
export type Consumer = {
  active: ConsumerNode | null;
};

export type GraphEdges = {
  consumer: Consumer;
  trackDependency: (producer: ProducerNode, consumer: ConsumerNode) => void;
  detachAll: (dependency: Dependency) => void;
  track: <T>(node: ConsumerNode, fn: () => T) => T;
};

// Unlink a dependency from producer's consumer list
const unlinkFromProducer = (
  producer: ProducerNode,
  prevConsumer: Dependency | undefined,
  nextConsumer: Dependency | undefined
): void => {
  if (nextConsumer !== undefined) nextConsumer.prevConsumer = prevConsumer;
  else producer.subscribersTail = prevConsumer;

  if (prevConsumer !== undefined) prevConsumer.nextConsumer = nextConsumer;
  else producer.subscribers = nextConsumer;
};

/**
 * Detach all dependencies from a consumer node.
 * Used during disposal to completely disconnect a node from the graph.
 */
const detachAll = (dep: Dependency): void => {
  // All dependencies in the chain share the same consumer
  const consumer = dep.consumer;
  let current: Dependency | undefined = dep;

  do {
    const next: Dependency | undefined = current.nextDependency;
    const { producer, prevDependency, prevConsumer, nextConsumer } = current;

    // Unlink from consumer chain
    if (next) next.prevDependency = prevDependency;
    else consumer.dependencyTail = prevDependency;

    if (prevDependency) prevDependency.nextDependency = next;
    else consumer.dependencies = next;

    // Unlink from producer chain
    unlinkFromProducer(producer, prevConsumer, nextConsumer);

    current = next;
  } while (current);
};

export function createGraphEdges(): GraphEdges {
  // Consumer tracking state - owned by this graph edges instance
  const consumer: Consumer = { active: null };

  // Tracking version counter - incremented on each tracking cycle
  // Used to detect stale dependencies
  let trackingVersion = 0;

  const trackDependency = (producer: FromNode, consumerNode: ToNode): void => {
    const currDep = consumerNode.dependencyTail;

    // Fast path: tail already points to this producer
    if (currDep !== undefined && currDep.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      currDep.version = trackingVersion;
      return; // Already tracking
    }

    // Check next dependency in sequence
    const next = currDep ? currDep.nextDependency : consumerNode.dependencies;
    if (next !== undefined && next.producer === producer) {
      // Update version to mark as accessed in this tracking cycle
      next.version = trackingVersion;
      consumerNode.dependencyTail = next;
      return; // Found and reused
    }

    // Get tail of producer's subscriber list for O(1) append
    const prevConsumer = producer.subscribersTail;

    // Create new dependency edge
    const dep: Dependency = {
      producer,
      consumer: consumerNode,
      prevDependency: currDep,
      prevConsumer,
      nextDependency: next,
      nextConsumer: undefined,
      version: trackingVersion,
    };

    // Wire consumer side
    consumerNode.dependencyTail = dep;

    if (next) next.prevDependency = dep;
    if (currDep) currDep.nextDependency = dep;
    else consumerNode.dependencies = dep;

    // Wire producer side - single subscriber list for all consumers
    if (prevConsumer) prevConsumer.nextConsumer = dep;
    else producer.subscribers = dep;

    producer.subscribersTail = dep;
  };

  const track = <T>(node: ConsumerNode, fn: () => T): T => {
    trackingVersion++;

    // Clear dirty and pending flags before tracking
    node.status = (node.status & TYPE_MASK) | CLEAN;

    const prevConsumer = consumer.active;
    node.dependencyTail = undefined;
    consumer.active = node;

    try {
      return fn();
    } finally {
      // Record when this node was last tracked (for staleness detection)
      node.trackingVersion = trackingVersion;
      consumer.active = prevConsumer;

      // Prune stale dependencies (everything after dependencyTail)
      // dependencyTail marks the last dependency accessed in this tracking cycle
      // Anything after it is stale and should be removed
      const tail = node.dependencyTail as Dependency | undefined;

      // Start point for pruning
      let toRemove = tail ? tail.nextDependency : node.dependencies;

      if (toRemove !== undefined) {
        do {
          const next: Dependency | undefined = toRemove.nextDependency;
          const { producer, prevConsumer, nextConsumer } = toRemove;

          // Unlink from consumer chain
          if (next !== undefined) next.prevDependency = tail;
          if (tail) tail.nextDependency = next;
          else node.dependencies = next;

          // Unlink from producer chain
          unlinkFromProducer(producer, prevConsumer, nextConsumer);

          toRemove = next;
        } while (toRemove);
      }
    }
  };

  return {
    consumer,
    trackDependency,
    detachAll,
    track,
  };
}

/**
 * GraphEdges module - provides the core reactive graph infrastructure.
 * No dependencies - this is a foundational module.
 */
export const GraphEdgesModule = defineModule({
  name: 'graphEdges',
  create: createGraphEdges,
});
