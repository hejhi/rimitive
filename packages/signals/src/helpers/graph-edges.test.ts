import { describe, it, expect } from 'vitest';
import { createGraphEdges } from './graph-edges';
import type { ProducerNode, ConsumerNode, Dependency } from '../types';
import { GlobalContext } from '../context';

/**
 * PRINCIPLED TESTS FOR GRAPH-EDGES
 *
 * These tests validate the fundamental invariants of the dependency graph
 * from first principles of FRP theory, not implementation details.
 *
 * Core Invariants:
 * 1. Bidirectional Consistency: producer.subscribers ⟷ consumer.dependencies
 * 2. List Integrity: Doubly-linked list pointers must be consistent
 * 3. Version-based Tracking: Dependencies track access patterns correctly
 * 4. Memory Safety: No dangling references after cleanup
 * 5. Graph Acyclicity: The dependency graph must remain a DAG
 */

// Test utilities for creating mock nodes
function createProducer(_: string): ProducerNode {
  return {
    __type: 'producer',
    status: 0, // STATUS_CLEAN
    value: undefined,
    subscribers: undefined,
    subscribersTail: undefined,
  };
}

function createConsumer(_: string): ConsumerNode {
  return {
    __type: 'consumer',
    status: 0, // STATUS_CLEAN
    dependencies: undefined,
    dependencyTail: undefined,
    trackingVersion: 0,
  };
}

function createContext(): GlobalContext {
  return {
    consumerScope: null,
    batchDepth: 0,
    inNotificationPhase: false,
  } as GlobalContext;
}

// Helper to verify list integrity invariant
function assertListIntegrity(node: ConsumerNode | ProducerNode): void {
  if ('dependencies' in node) {
    // Check consumer's dependency list
    let dep = node.dependencies;
    let prev: Dependency | undefined = undefined;
    while (dep) {
      expect(dep.prevDependency).toBe(prev);
      if (prev) {
        expect(prev.nextDependency).toBe(dep);
      }
      prev = dep;
      dep = dep.nextDependency;
    }
    // Tail should point to last dependency
    if (node.dependencyTail) {
      expect(node.dependencyTail.nextDependency).toBeUndefined();
    }
  }

  if ('subscribers' in node) {
    // Check producer's subscriber list
    let sub = node.subscribers;
    let prev: Dependency | undefined = undefined;
    while (sub) {
      expect(sub.prevConsumer).toBe(prev);
      if (prev) {
        expect(prev.nextConsumer).toBe(sub);
      }
      prev = sub;
      sub = sub.nextConsumer;
    }
    // Tail should point to last subscriber
    if (node.subscribersTail) {
      expect(node.subscribersTail.nextConsumer).toBeUndefined();
    }
  }
}

describe('graph-edges: Fundamental Invariants', () => {
  it('should establish bidirectional dependency relationship', () => {
    // PRINCIPLE: In FRP, a dependency edge must be bidirectional
    // If A depends on B, then B must know A depends on it
    const edges = createGraphEdges();
    const producer = createProducer('signal');
    const consumer = createConsumer('computed');

    edges.trackDependency(producer, consumer);

    // Verify bidirectional link exists
    expect(consumer.dependencies).toBeDefined();
    expect(producer.subscribers).toBeDefined();

    // Verify the same Dependency object is referenced from both sides
    const dep = consumer.dependencies!;
    expect(dep.producer).toBe(producer);
    expect(dep.consumer).toBe(consumer);
    expect(producer.subscribers).toBe(dep);

    // Verify list integrity
    assertListIntegrity(producer);
    assertListIntegrity(consumer);
  });

  it('should be idempotent - multiple calls create single edge', () => {
    // PRINCIPLE: FRP graphs must not have duplicate edges
    // Multiple dependency tracking of same pair should result in single edge
    const edges = createGraphEdges();
    const producer = createProducer('signal');
    const consumer = createConsumer('computed');

    // Track dependency multiple times
    edges.trackDependency(producer, consumer);
    const firstDep = consumer.dependencies;

    edges.trackDependency(producer, consumer);
    edges.trackDependency(producer, consumer);

    // Should still have only one dependency
    expect(consumer.dependencies).toBe(firstDep);
    expect(consumer.dependencies?.nextDependency).toBeUndefined();
    expect(producer.subscribers).toBe(firstDep);
    expect(producer.subscribers?.nextConsumer).toBeUndefined();

    // Version should be updated to latest tracking version
    expect(consumer.dependencies?.version).toBe(consumer.trackingVersion);

    // Verify list integrity is maintained
    assertListIntegrity(producer);
    assertListIntegrity(consumer);
  });

  it('should support fan-out: one producer, multiple consumers', () => {
    // PRINCIPLE: In FRP, a signal can have multiple dependents
    // This tests the producer's subscriber list management
    const edges = createGraphEdges();
    const producer = createProducer('signal');
    const consumer1 = createConsumer('computed1');
    const consumer2 = createConsumer('computed2');
    const consumer3 = createConsumer('computed3');

    // Create dependencies
    edges.trackDependency(producer, consumer1);
    edges.trackDependency(producer, consumer2);
    edges.trackDependency(producer, consumer3);

    // Verify all consumers have correct dependency
    expect(consumer1.dependencies?.producer).toBe(producer);
    expect(consumer2.dependencies?.producer).toBe(producer);
    expect(consumer3.dependencies?.producer).toBe(producer);

    // Verify producer has all subscribers in its list
    let count = 0;
    let sub = producer.subscribers;
    const consumers = new Set<ConsumerNode>();
    while (sub) {
      consumers.add(sub.consumer as ConsumerNode);
      count++;
      sub = sub.nextConsumer;
    }
    expect(count).toBe(3);
    expect(consumers.has(consumer1)).toBe(true);
    expect(consumers.has(consumer2)).toBe(true);
    expect(consumers.has(consumer3)).toBe(true);

    // Verify tail points to last added
    expect(producer.subscribersTail!.consumer).toBe(consumer3);

    // Verify list integrity for all nodes
    assertListIntegrity(producer);
    assertListIntegrity(consumer1);
    assertListIntegrity(consumer2);
    assertListIntegrity(consumer3);
  });

  it('should support fan-in: multiple producers, one consumer', () => {
    // PRINCIPLE: In FRP, computed values can depend on multiple signals
    // This tests the consumer's dependency list management
    const edges = createGraphEdges();
    const producer1 = createProducer('signal1');
    const producer2 = createProducer('signal2');
    const producer3 = createProducer('signal3');
    const consumer = createConsumer('computed');

    // Create dependencies
    edges.trackDependency(producer1, consumer);
    edges.trackDependency(producer2, consumer);
    edges.trackDependency(producer3, consumer);

    // Verify consumer has dependencies on all producers
    let count = 0;
    let dep = consumer.dependencies;
    const producers = new Set<ProducerNode>();
    while (dep) {
      producers.add(dep.producer as ProducerNode);
      count++;
      dep = dep.nextDependency;
    }
    expect(count).toBe(3);
    expect(producers.has(producer1)).toBe(true);
    expect(producers.has(producer2)).toBe(true);
    expect(producers.has(producer3)).toBe(true);

    // Verify each producer has consumer as subscriber
    expect(producer1.subscribers?.consumer).toBe(consumer);
    expect(producer2.subscribers?.consumer).toBe(consumer);
    expect(producer3.subscribers?.consumer).toBe(consumer);

    // Verify tail points to last added
    expect(consumer.dependencyTail?.producer).toBe(producer3);

    // Verify list integrity for all nodes
    assertListIntegrity(producer1);
    assertListIntegrity(producer2);
    assertListIntegrity(producer3);
    assertListIntegrity(consumer);
  });
});

describe('graph-edges: Dependency Tracking with track()', () => {
  it('should collect dependencies during track execution', () => {
    // PRINCIPLE: FRP dependency tracking must be automatic and transparent
    const edges = createGraphEdges();
    const ctx = createContext();
    const producer1 = createProducer('signal1');
    const producer2 = createProducer('signal2');
    const consumer = createConsumer('computed');

    // Track dependencies within a computation
    const result = edges.track(ctx, consumer, () => {
      // Simulate reading from producers
      edges.trackDependency(producer1, consumer);
      edges.trackDependency(producer2, consumer);
      return 'computed value';
    });

    expect(result).toBe('computed value');

    // Verify dependencies were tracked
    let count = 0;
    let dep = consumer.dependencies;
    while (dep) {
      count++;
      dep = dep.nextDependency;
    }
    expect(count).toBe(2);

    // Verify tracking version was incremented
    expect(consumer.trackingVersion).toBe(1);

    // Verify dependency versions match tracking version
    dep = consumer.dependencies;
    while (dep) {
      expect(dep.version).toBe(consumer.trackingVersion);
      dep = dep.nextDependency;
    }

    assertListIntegrity(consumer);
  });

  it('should prune stale dependencies on re-tracking', () => {
    // PRINCIPLE: Dynamic dependency graphs must remove unused edges
    // This prevents memory leaks and ensures correct propagation
    const edges = createGraphEdges();
    const ctx = createContext();
    const producer1 = createProducer('signal1');
    const producer2 = createProducer('signal2');
    const producer3 = createProducer('signal3');
    const consumer = createConsumer('computed');

    // First tracking: depend on all three producers
    edges.track(ctx, consumer, () => {
      edges.trackDependency(producer1, consumer);
      edges.trackDependency(producer2, consumer);
      edges.trackDependency(producer3, consumer);
    });

    // Verify all three dependencies exist
    let deps = new Set<ProducerNode>();
    let dep = consumer.dependencies;
    while (dep) {
      deps.add(dep.producer as ProducerNode);
      dep = dep.nextDependency;
    }
    expect(deps.size).toBe(3);
    expect(deps.has(producer1)).toBe(true);
    expect(deps.has(producer2)).toBe(true);
    expect(deps.has(producer3)).toBe(true);

    // Second tracking: only depend on producer1 and producer3
    // producer2 should be pruned
    edges.track(ctx, consumer, () => {
      edges.trackDependency(producer1, consumer);
      edges.trackDependency(producer3, consumer);
    });

    // Verify only two dependencies remain
    deps = new Set<ProducerNode>();
    dep = consumer.dependencies;
    while (dep) {
      deps.add(dep.producer as ProducerNode);
      dep = dep.nextDependency;
    }
    expect(deps.size).toBe(2);
    expect(deps.has(producer1)).toBe(true);
    expect(deps.has(producer3)).toBe(true);
    expect(deps.has(producer2)).toBe(false);

    // Verify producer2 no longer has consumer as subscriber
    expect(producer2.subscribers).toBeUndefined();

    // Verify producer1 and producer3 still have consumer
    expect(producer1.subscribers!.consumer).toBe(consumer);
    expect(producer3.subscribers!.consumer).toBe(consumer);

    // Verify list integrity
    assertListIntegrity(consumer);
    assertListIntegrity(producer1);
    assertListIntegrity(producer2);
    assertListIntegrity(producer3);
  });

  it('should handle complete dependency replacement', () => {
    // PRINCIPLE: FRP systems must handle dynamic dependency graphs efficiently
    const edges = createGraphEdges();
    const ctx = createContext();
    const producer1 = createProducer('signal1');
    const producer2 = createProducer('signal2');
    const producer3 = createProducer('signal3');
    const producer4 = createProducer('signal4');
    const consumer = createConsumer('computed');

    // First tracking: depend on producer1 and producer2
    edges.track(ctx, consumer, () => {
      edges.trackDependency(producer1, consumer);
      edges.trackDependency(producer2, consumer);
    });

    // Second tracking: completely different set - producer3 and producer4
    edges.track(ctx, consumer, () => {
      edges.trackDependency(producer3, consumer);
      edges.trackDependency(producer4, consumer);
    });

    // Verify old dependencies are gone
    expect(producer1.subscribers).toBeUndefined();
    expect(producer2.subscribers).toBeUndefined();

    // Verify new dependencies exist
    let deps = new Set<ProducerNode>();
    let dep = consumer.dependencies;
    while (dep) {
      deps.add(dep.producer as ProducerNode);
      dep = dep.nextDependency;
    }
    expect(deps.size).toBe(2);
    expect(deps.has(producer3)).toBe(true);
    expect(deps.has(producer4)).toBe(true);

    assertListIntegrity(consumer);
  });
});

describe('graph-edges: Cleanup and Memory Safety', () => {
  it('should detach all dependencies from a consumer', () => {
    // PRINCIPLE: FRP nodes must be cleanly disposable to prevent memory leaks
    const edges = createGraphEdges();
    const producer1 = createProducer('signal1');
    const producer2 = createProducer('signal2');
    const producer3 = createProducer('signal3');
    const consumer = createConsumer('computed');

    // Create multiple dependencies
    edges.trackDependency(producer1, consumer);
    edges.trackDependency(producer2, consumer);
    edges.trackDependency(producer3, consumer);

    // Verify dependencies exist
    expect(consumer.dependencies).toBeDefined();
    expect(producer1.subscribers).toBeDefined();
    expect(producer2.subscribers).toBeDefined();
    expect(producer3.subscribers).toBeDefined();

    // Detach all dependencies
    const firstDep = consumer.dependencies!;
    edges.detachAll(firstDep);

    // Verify consumer has no dependencies
    expect(consumer.dependencies).toBeUndefined();
    expect(consumer.dependencyTail).toBeUndefined();

    // Verify producers have no subscribers
    expect(producer1.subscribers).toBeUndefined();
    expect(producer2.subscribers).toBeUndefined();
    expect(producer3.subscribers).toBeUndefined();

    // Verify list integrity (empty lists should still be valid)
    assertListIntegrity(consumer);
    assertListIntegrity(producer1);
    assertListIntegrity(producer2);
    assertListIntegrity(producer3);
  });

  it('should handle partial detachment in complex graphs', () => {
    // PRINCIPLE: Cleanup must be surgical - only remove specified edges
    const edges = createGraphEdges();
    const producer = createProducer('signal');
    const consumer1 = createConsumer('computed1');
    const consumer2 = createConsumer('computed2');
    const consumer3 = createConsumer('computed3');

    // Create fan-out dependencies
    edges.trackDependency(producer, consumer1);
    edges.trackDependency(producer, consumer2);
    edges.trackDependency(producer, consumer3);

    // Detach only consumer2's dependencies
    const consumer2Dep = consumer2.dependencies!;
    edges.detachAll(consumer2Dep);

    // Verify consumer2 is detached
    expect(consumer2.dependencies).toBeUndefined();

    // Verify producer still has consumer1 and consumer3
    let count = 0;
    let sub = producer.subscribers;
    const remainingConsumers = new Set<ConsumerNode>();
    while (sub) {
      remainingConsumers.add(sub.consumer as ConsumerNode);
      count++;
      sub = sub.nextConsumer;
    }
    expect(count).toBe(2);
    expect(remainingConsumers.has(consumer1)).toBe(true);
    expect(remainingConsumers.has(consumer3)).toBe(true);
    expect(remainingConsumers.has(consumer2)).toBe(false);

    assertListIntegrity(producer);
    assertListIntegrity(consumer1);
    assertListIntegrity(consumer2);
    assertListIntegrity(consumer3);
  });

  it('should maintain graph integrity after complex operations', () => {
    // PRINCIPLE: Graph operations must never corrupt the data structure
    // This test performs a series of complex operations to verify integrity
    const edges = createGraphEdges();
    const ctx = createContext();
    const p1 = createProducer('p1');
    const p2 = createProducer('p2');
    const p3 = createProducer('p3');
    const c1 = createConsumer('c1');
    const c2 = createConsumer('c2');

    // Build initial graph: c1 depends on p1, p2; c2 depends on p2, p3
    edges.track(ctx, c1, () => {
      edges.trackDependency(p1, c1);
      edges.trackDependency(p2, c1);
    });

    edges.track(ctx, c2, () => {
      edges.trackDependency(p2, c2);
      edges.trackDependency(p3, c2);
    });

    // Verify p2 has both consumers
    let count = 0;
    let sub = p2.subscribers;
    while (sub) {
      count++;
      sub = sub.nextConsumer;
    }
    expect(count).toBe(2);

    // Re-track c1 to depend only on p3
    edges.track(ctx, c1, () => {
      edges.trackDependency(p3, c1);
    });

    // Verify p1 has no subscribers
    expect(p1.subscribers).toBeUndefined();

    // Verify p3 has both consumers
    count = 0;
    sub = p3.subscribers;
    const p3Consumers = new Set<ConsumerNode>();
    while (sub) {
      p3Consumers.add(sub.consumer as ConsumerNode);
      count++;
      sub = sub.nextConsumer;
    }
    expect(count).toBe(2);
    expect(p3Consumers.has(c1)).toBe(true);
    expect(p3Consumers.has(c2)).toBe(true);

    // Detach c2 completely
    edges.detachAll(c2.dependencies!);

    // Verify final state
    expect(p2.subscribers).toBeUndefined(); // p2 has no subscribers
    expect(p3.subscribers!.consumer).toBe(c1); // p3 only has c1
    expect(p3.subscribers!.nextConsumer).toBeUndefined();

    // Verify all list integrity
    assertListIntegrity(p1);
    assertListIntegrity(p2);
    assertListIntegrity(p3);
    assertListIntegrity(c1);
    assertListIntegrity(c2);
  });

  it('should handle exception safety in track function', () => {
    // PRINCIPLE: FRP tracking must maintain consistency even when computations fail
    const edges = createGraphEdges();
    const ctx = createContext();
    const producer = createProducer('signal');
    const consumer = createConsumer('computed');

    // Track with throwing function
    expect(() => {
      edges.track(ctx, consumer, () => {
        edges.trackDependency(producer, consumer);
        throw new Error('Computation failed');
      });
    }).toThrow('Computation failed');

    // Verify dependencies were still tracked despite error
    expect(consumer.dependencies).toBeDefined();
    expect(consumer.dependencies!.producer).toBe(producer);
    expect(producer.subscribers!.consumer).toBe(consumer);

    // Verify tracking version was incremented
    expect(consumer.trackingVersion).toBe(1);

    // Verify list integrity is maintained
    assertListIntegrity(consumer);
    assertListIntegrity(producer);
  });
});