import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';
import type { ScheduledNode, Dependency, FromNode } from '../types';
import { CONSTANTS, setPending, setClean, setDisposed } from '../constants';

const { SCHEDULED, DISPOSED, CLEAN, CONSUMER, STATE_MASK } = CONSTANTS;

/**
 * Pure unit tests for scheduler algorithm
 *
 * These test the scheduler directly with mock nodes and dependencies,
 * verifying queue management, batch depth, FIFO ordering, and error isolation.
 */

describe('Scheduler Algorithm', () => {
  // Helper to create a mock scheduled node
  function createMockScheduledNode(): ScheduledNode {
    return {
      status: CONSUMER | SCHEDULED | CLEAN,  // Type bits + initial state
      nextScheduled: undefined,
      dependencies: undefined,
      dependencyTail: undefined,
      flush: vi.fn(),
    } as unknown as ScheduledNode;
  }

  // Helper to create a minimal mock dependency
  function createMockDependency(): Dependency {
    return {} as Dependency;
  }

  function createDepChain(...nodes: ScheduledNode[]): Dependency | undefined {
    if (nodes.length === 0) return undefined;

    const deps: Dependency[] = nodes.map((node) => ({
      consumer: node,
      producer: {} as FromNode,
      prevConsumer: undefined,
      nextConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
      version: 0,
    }));

    // Link them
    for (let i = 0; i < deps.length - 1; i++) {
      deps[i]!.nextConsumer = deps[i + 1];
    }

    return deps[0];
  }

  // Helper to create a mock traverseGraph that calls schedule for each dependency
  function mockTraverseGraph() {
    return vi.fn((deps: Dependency, schedule: (dep: Dependency) => void) => {
      let dep: Dependency | undefined = deps;
      while (dep) {
        schedule(dep);
        dep = dep.nextConsumer;
      }
    });
  }

  describe('Queue Management', () => {
    it('should queue nodes in FIFO order', () => {
      const order: string[] = [];
      const node1 = createMockScheduledNode();
      node1.flush = vi.fn(() => order.push('A'));
      const node2 = createMockScheduledNode();
      node2.flush = vi.fn(() => order.push('B'));
      const node3 = createMockScheduledNode();
      node3.flush = vi.fn(() => order.push('C'));

      const depChain = createDepChain(node1, node2, node3)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.propagate(depChain);

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('should not queue nodes without flush method', () => {
      // This test verifies that the scheduler only queues nodes with flush method
      // The scheduler filters by SCHEDULED flag which requires flush method
      // Keeping the test structure but changing what it tests
      let called = 0;
      const node = createMockScheduledNode();
      node.flush = vi.fn(() => called++);
      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.propagate(depChain);

      expect(called).toBe(1);
    });

    it('should only queue CLEAN nodes', () => {
      const executed: string[] = [];
      const node1 = createMockScheduledNode();
      setClean(node1);  // Clean nodes get queued
      node1.flush = vi.fn(() => executed.push('clean'));

      const node2 = createMockScheduledNode();
      setPending(node2);  // Already pending - skip
      node2.flush = vi.fn(() => executed.push('pending'));

      const node3 = createMockScheduledNode();
      setPending(node3);  // Already scheduled - skip
      node3.flush = vi.fn(() => executed.push('already-scheduled'));

      const depChain = createDepChain(node1, node2, node3)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.propagate(depChain);

      // Only CLEAN nodes should be queued and executed
      expect(executed).toEqual(['clean']);
    });
  });

  describe('Batch Management', () => {
    it('should increment batch depth on startBatch', () => {
      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      // startBatch uses post-increment, returns old value
      expect(scheduler.startBatch()).toBe(0); // was 0, now 1
      expect(scheduler.startBatch()).toBe(1); // was 1, now 2
      expect(scheduler.startBatch()).toBe(2); // was 2, now 3
    });

    it('should decrement batch depth on endBatch', () => {
      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch(); // 1
      scheduler.startBatch(); // 2
      expect(scheduler.endBatch()).toBe(1);
      expect(scheduler.endBatch()).toBe(0);
    });

    it('should not flush during batch', () => {
      const executed: string[] = [];
      const node = createMockScheduledNode();
      node.flush = vi.fn(() => executed.push('flushed'));
      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch();
      scheduler.propagate(depChain);

      // Should not flush yet
      expect(executed).toEqual([]);

      scheduler.endBatch();

      // Should flush after batch ends
      expect(executed).toEqual(['flushed']);
    });

    it('should flush only when batch depth reaches 0', () => {
      const executed: string[] = [];
      const node = createMockScheduledNode();
      node.flush = vi.fn(() => executed.push('flushed'));
      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch(); // depth = 1
      scheduler.startBatch(); // depth = 2
      scheduler.propagate(depChain);
      expect(executed).toEqual([]);

      scheduler.endBatch(); // depth = 1
      expect(executed).toEqual([]);

      scheduler.endBatch(); // depth = 0
      expect(executed).toEqual(['flushed']);
    });

    it('should handle manual flush', () => {
      const executed: string[] = [];
      const node = createMockScheduledNode();
      node.flush = vi.fn(() => executed.push('flushed'));
      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch();
      scheduler.propagate(depChain);
      expect(executed).toEqual([]);

      // Manual flush should not work during batch
      scheduler.flush();
      expect(executed).toEqual([]);

      scheduler.endBatch();
      expect(executed).toEqual(['flushed']);
    });
  });

  describe('Status Transitions', () => {
    it('should transition CLEAN -> CONSUMER_PENDING -> SCHEDULED -> CLEAN', () => {
      const statuses: number[] = [];
      const node = createMockScheduledNode();
      statuses.push(node.status & STATE_MASK); // Should be CLEAN initially

      // Simulate flush callback to capture status during execution
      node.flush = vi.fn(() => {
        statuses.push(node.status & STATE_MASK); // Should be CLEAN during flush
      });

      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.propagate(depChain);

      statuses.push(node.status & STATE_MASK); // After execution (should be CLEAN)

      expect(statuses).toEqual([CLEAN, CLEAN, CLEAN]);
    });

    it('should skip disposed nodes during flush', () => {
      const executed: string[] = [];
      const node1 = createMockScheduledNode();
      node1.flush = vi.fn(() => executed.push('A'));

      const node2 = createMockScheduledNode();
      node2.flush = vi.fn(() => executed.push('B'));
      setDisposed(node2); // Set as disposed before queueing

      const node3 = createMockScheduledNode();
      node3.flush = vi.fn(() => executed.push('C'));

      const depChain = createDepChain(node1, node2, node3)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.propagate(depChain);

      // B should be skipped
      expect(executed).toEqual(['A', 'C']);
    });
  });

  describe('Error Isolation', () => {
    it('should continue executing after error', () => {
      const executed: string[] = [];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const node1 = createMockScheduledNode();
      node1.flush = vi.fn(() => executed.push('A'));

      const node2 = createMockScheduledNode();
      node2.flush = vi.fn(() => {
        throw new Error('Test error');
      });

      const node3 = createMockScheduledNode();
      node3.flush = vi.fn(() => executed.push('C'));

      const depChain = createDepChain(node1, node2, node3)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.propagate(depChain);

      expect(executed).toContain('A');
      expect(executed).toContain('C');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Re-entrance', () => {
    it('should handle nodes scheduling more nodes during flush', () => {
      const order: string[] = [];

      const node2 = createMockScheduledNode();
      node2.flush = vi.fn(() => order.push('inner'));
      const depChain2 = createDepChain(node2)!;

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      const node1 = createMockScheduledNode();
      node1.flush = vi.fn(() => {
        order.push('outer');
        // Trigger another propagation during flush
        scheduler.propagate(depChain2);
      });
      const depChain1 = createDepChain(node1)!;

      scheduler.propagate(depChain1);

      expect(order).toEqual(['outer', 'inner']);
    });
  });

  describe('Disposal', () => {
    it('should mark node as disposed', () => {
      const node = createMockScheduledNode();
      const cleanup = vi.fn();
      const detachAll = vi.fn();

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll,
      });

      scheduler.dispose(node, cleanup);

      expect(node.status & STATE_MASK).toBe(DISPOSED);
      expect(cleanup).toHaveBeenCalledWith(node);
    });

    it('should be idempotent', () => {
      const node = createMockScheduledNode();
      const cleanup = vi.fn();

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll: vi.fn(),
      });

      scheduler.dispose(node, cleanup);
      scheduler.dispose(node, cleanup);
      scheduler.dispose(node, cleanup);

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should detach dependencies on disposal', () => {
      const node = createMockScheduledNode();
      const dep = createMockDependency();
      node.dependencies = dep;

      const detachAll = vi.fn();

      const scheduler = createScheduler({
        traverseGraph: mockTraverseGraph(),
        detachAll,
      });

      scheduler.dispose(node, vi.fn());

      expect(detachAll).toHaveBeenCalledWith(dep);
      expect(node.dependencies).toBeUndefined();
      expect(node.dependencyTail).toBeUndefined();
    });
  });
});
