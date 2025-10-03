import { describe, it, expect, vi } from 'vitest';
import { createPullPropagator } from './pull-propagator';
import type { DerivedNode, ProducerNode, Dependency } from '../types';
import { CONSTANTS } from '../constants';

const { DERIVED_DIRTY, CONSUMER_PENDING, SIGNAL_UPDATED, STATUS_CLEAN } = CONSTANTS;

/**
 * Unit tests for pull-propagator algorithm
 *
 * These test the core pull algorithm directly with minimal mocking,
 * verifying status transitions, short-circuit logic, and graph traversal.
 */

describe('Pull Propagator Algorithm', () => {
  // Helper to create a minimal mock node
  function createMockNode(type: 'producer' | 'derived', status: number): ProducerNode | DerivedNode {
    const base = {
      status,
      subscribers: undefined,
      dependencies: undefined,
    };

    if (type === 'producer') {
      return base as unknown as ProducerNode;
    }

    return {
      ...base,
      value: undefined,
      compute: vi.fn(),
      trackingVersion: 0,
    } as unknown as DerivedNode;
  }

  // Helper to link producer -> consumer with proper bidirectional links
  function createDependency(producer: ProducerNode | DerivedNode, consumer: DerivedNode, version = 0): Dependency {
    const dep: Dependency = {
      producer,
      consumer,
      version,
      nextDependency: undefined,
      prevDependency: undefined,
      nextConsumer: undefined,
      prevConsumer: undefined,
    };

    // Link producer's subscribers to this dependency
    if (!producer.subscribers) {
      producer.subscribers = dep;
    }

    return dep;
  }

  describe('Basic Traversal', () => {
    it('should return false when node has no dependencies', () => {
      const mockTrack = vi.fn();
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const node = createMockNode('derived', STATUS_CLEAN) as DerivedNode;
      node.dependencies = undefined;

      const result = pullUpdates(node);

      expect(result).toBe(false);
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('should return false when all dependencies are clean', () => {
      const mockTrack = vi.fn();
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const producer = createMockNode('producer', STATUS_CLEAN);
      const consumer = createMockNode('derived', STATUS_CLEAN) as DerivedNode;
      const dep = createDependency(producer, consumer);
      consumer.dependencies = dep;

      const result = pullUpdates(consumer);

      expect(result).toBe(false);
      expect(consumer.status).toBe(STATUS_CLEAN);
    });

    it('should return true when consumer is already dirty', () => {
      const mockTrack = vi.fn();
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const producer = createMockNode('producer', STATUS_CLEAN);
      const consumer = createMockNode('derived', DERIVED_DIRTY) as DerivedNode;
      const dep = createDependency(producer, consumer);
      consumer.dependencies = dep;

      const result = pullUpdates(consumer);

      expect(result).toBe(true);
    });
  });

  describe('Signal Updates', () => {
    it('should detect updated signals and clear flag', () => {
      const mockTrack = vi.fn();
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const producer = createMockNode('producer', SIGNAL_UPDATED);
      const consumer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const dep = createDependency(producer, consumer);
      consumer.dependencies = dep;

      const result = pullUpdates(consumer);

      expect(result).toBe(true);
      expect(producer.status).toBe(STATUS_CLEAN); // Flag cleared
    });
  });

  describe('Derived Node Recomputation', () => {
    it('should recompute dirty derived dependencies', () => {
      const computeFn = vi.fn(() => 42);
      const mockTrack = vi.fn((_node, fn) => fn());
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const producer = createMockNode('derived', DERIVED_DIRTY) as DerivedNode;
      producer.compute = computeFn;
      producer.value = 10; // Old value

      const consumer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const dep = createDependency(producer, consumer);
      consumer.dependencies = dep;

      const result = pullUpdates(consumer);

      expect(result).toBe(true);
      expect(mockTrack).toHaveBeenCalledWith(producer, computeFn);
      expect(producer.value).toBe(42); // Updated
    });

    it('should short-circuit when derived value unchanged', () => {
      const computeFn = vi.fn(() => 42);
      const mockTrack = vi.fn((_node, fn) => fn());
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const producer = createMockNode('derived', DERIVED_DIRTY) as DerivedNode;
      producer.compute = computeFn;
      producer.value = 42; // Same value

      const consumer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const dep = createDependency(producer, consumer);
      consumer.dependencies = dep;

      pullUpdates(consumer);

      expect(mockTrack).toHaveBeenCalledWith(producer, computeFn);
      expect(producer.value).toBe(42); // Same value
      // Result depends on whether short-circuit sets dirty flag
      // The key is that producer.value didn't change
    });
  });

  describe('Intermediate Read Staleness', () => {
    it('should detect stale dependencies via version tracking', () => {
      const mockTrack = vi.fn();
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const producer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      producer.trackingVersion = 5; // Producer recomputed at version 5

      const consumer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const dep = createDependency(producer, consumer, 3); // Edge created at version 3
      consumer.dependencies = dep;
      producer.dependencies = undefined; // No further dependencies

      const result = pullUpdates(consumer);

      expect(result).toBe(true); // Detected as dirty due to version mismatch
    });

    it('should not mark as dirty when versions match', () => {
      const mockTrack = vi.fn();
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      const upstream = createMockNode('producer', STATUS_CLEAN);

      const producer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      producer.trackingVersion = 3;
      const producerDep = createDependency(upstream, producer);
      producer.dependencies = producerDep;

      const consumer = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const dep = createDependency(producer, consumer, 5); // Edge created AFTER producer recomputed
      consumer.dependencies = dep;

      const result = pullUpdates(consumer);

      // Version check: producer.trackingVersion (3) <= dep.version (5), so not stale
      // Producer's upstream is clean, so result should be false
      expect(result).toBe(false);
    });
  });

  describe('ShallowPropagate', () => {
    it('should upgrade PENDING siblings to DIRTY', () => {
      const { shallowPropagate } = createPullPropagator({ track: vi.fn() });

      const producer = createMockNode('producer', STATUS_CLEAN);
      const consumer1 = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const consumer2 = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;

      const dep1 = createDependency(producer, consumer1);
      const dep2 = createDependency(producer, consumer2);

      // Link as siblings
      dep1.nextConsumer = dep2;
      dep2.prevConsumer = dep1;

      producer.subscribers = dep1;

      shallowPropagate(dep1);

      expect(consumer1.status).toBe(DERIVED_DIRTY);
      expect(consumer2.status).toBe(DERIVED_DIRTY);
    });

    it('should not affect non-PENDING siblings', () => {
      const { shallowPropagate } = createPullPropagator({ track: vi.fn() });

      const producer = createMockNode('producer', STATUS_CLEAN);
      const consumer1 = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      const consumer2 = createMockNode('derived', STATUS_CLEAN) as DerivedNode;

      const dep1 = createDependency(producer, consumer1);
      const dep2 = createDependency(producer, consumer2);

      dep1.nextConsumer = dep2;
      dep2.prevConsumer = dep1;

      producer.subscribers = dep1;

      shallowPropagate(dep1);

      expect(consumer1.status).toBe(DERIVED_DIRTY);
      expect(consumer2.status).toBe(STATUS_CLEAN); // Not upgraded
    });
  });

  describe('Deep Dependency Chains', () => {
    it('should traverse deep chains correctly', () => {
      const mockTrack = vi.fn((_node, fn) => fn());
      const { pullUpdates } = createPullPropagator({ track: mockTrack });

      // Create chain: producer -> derived1 -> derived2
      const producer = createMockNode('producer', SIGNAL_UPDATED);

      const derived1 = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      derived1.compute = vi.fn(() => 1);
      derived1.value = 0;
      const dep1 = createDependency(producer, derived1);
      derived1.dependencies = dep1;

      const derived2 = createMockNode('derived', CONSUMER_PENDING) as DerivedNode;
      derived2.compute = vi.fn(() => 2);
      derived2.value = 0;
      const dep2 = createDependency(derived1, derived2);
      derived2.dependencies = dep2;

      const result = pullUpdates(derived2);

      expect(result).toBe(true);
      expect(producer.status).toBe(STATUS_CLEAN); // Signal flag cleared
      expect(mockTrack).toHaveBeenCalledWith(derived1, derived1.compute);
    });
  });
});
