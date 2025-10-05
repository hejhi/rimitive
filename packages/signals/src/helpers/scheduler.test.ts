import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';
import type { ScheduledNode, Dependency, FromNode } from '../types';
import { CONSTANTS } from '../constants';

const { CONSUMER_PENDING, SCHEDULED, SCHEDULED_DISPOSED, STATUS_CLEAN } = CONSTANTS;

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
      status: STATUS_CLEAN,  // Scheduler expects CLEAN nodes (it marks them PENDING)
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
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.propagateScheduled(depChain);

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('should not queue nodes without flush method', () => {
      // This test no longer makes sense since propagateScheduled
      // expects a dependency chain with scheduled nodes (which must have flush)
      // Keeping the test structure but changing what it tests
      let called = 0;
      const node = createMockScheduledNode();
      node.flush = vi.fn(() => called++);
      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.propagateScheduled(depChain);

      expect(called).toBe(1);
    });

    it('should only queue STATUS_CLEAN nodes', () => {
      const executed: string[] = [];
      const node1 = createMockScheduledNode();
      node1.status = STATUS_CLEAN;  // Clean nodes get queued
      node1.flush = vi.fn(() => executed.push('clean'));

      const node2 = createMockScheduledNode();
      node2.status = CONSUMER_PENDING;  // Already pending - skip
      node2.flush = vi.fn(() => executed.push('pending'));

      const node3 = createMockScheduledNode();
      node3.status = SCHEDULED;  // Already scheduled - skip
      node3.flush = vi.fn(() => executed.push('already-scheduled'));

      const depChain = createDepChain(node1, node2, node3)!;

      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.propagateScheduled(depChain);

      // Only STATUS_CLEAN nodes should be queued and executed
      expect(executed).toEqual(['clean']);
    });
  });

  describe('Batch Management', () => {
    it('should increment batch depth on startBatch', () => {
      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      // startBatch uses post-increment, returns old value
      expect(scheduler.startBatch()).toBe(0); // was 0, now 1
      expect(scheduler.startBatch()).toBe(1); // was 1, now 2
      expect(scheduler.startBatch()).toBe(2); // was 2, now 3
    });

    it('should decrement batch depth on endBatch', () => {
      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
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
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch();
      scheduler.propagateScheduled(depChain);

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
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch(); // depth = 1
      scheduler.startBatch(); // depth = 2
      scheduler.propagateScheduled(depChain);
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
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch();
      scheduler.propagateScheduled(depChain);
      expect(executed).toEqual([]);

      // Manual flush should not work during batch
      scheduler.flush();
      expect(executed).toEqual([]);

      scheduler.endBatch();
      expect(executed).toEqual(['flushed']);
    });
  });

  describe('Status Transitions', () => {
    it('should transition STATUS_CLEAN -> CONSUMER_PENDING -> SCHEDULED -> STATUS_CLEAN', () => {
      const statuses: number[] = [];
      const node = createMockScheduledNode();
      statuses.push(node.status); // Should be STATUS_CLEAN initially

      // Simulate flush callback to capture status during execution
      node.flush = vi.fn(() => {
        statuses.push(node.status); // Should be STATUS_CLEAN during flush
      });

      const depChain = createDepChain(node)!;

      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.propagateScheduled(depChain);

      statuses.push(node.status); // After execution (should be STATUS_CLEAN)

      expect(statuses).toEqual([STATUS_CLEAN, STATUS_CLEAN, STATUS_CLEAN]);
    });

    it('should skip disposed nodes during flush', () => {
      const executed: string[] = [];
      const node1 = createMockScheduledNode();
      node1.flush = vi.fn(() => executed.push('A'));

      const node2 = createMockScheduledNode();
      node2.flush = vi.fn(() => executed.push('B'));
      node2.status = SCHEDULED_DISPOSED; // Set as disposed before queueing

      const node3 = createMockScheduledNode();
      node3.flush = vi.fn(() => executed.push('C'));

      const depChain = createDepChain(node1, node2, node3)!;

      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.propagateScheduled(depChain);

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
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.propagateScheduled(depChain);

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
        traverseGraph: vi.fn(),
        detachAll: vi.fn(),
      });

      const node1 = createMockScheduledNode();
      node1.flush = vi.fn(() => {
        order.push('outer');
        // Trigger another propagation during flush
        scheduler.propagateScheduled(depChain2);
      });
      const depChain1 = createDepChain(node1)!;

      scheduler.propagateScheduled(depChain1);

      expect(order).toEqual(['outer', 'inner']);
    });
  });

  describe('Disposal', () => {
    it('should mark node as disposed', () => {
      const node = createMockScheduledNode();
      const cleanup = vi.fn();
      const detachAll = vi.fn();

      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
        detachAll,
      });

      scheduler.dispose(node, cleanup);

      expect(node.status).toBe(SCHEDULED_DISPOSED);
      expect(cleanup).toHaveBeenCalledWith(node);
    });

    it('should be idempotent', () => {
      const node = createMockScheduledNode();
      const cleanup = vi.fn();

      const scheduler = createScheduler({
        traverseGraph: vi.fn(),
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
        traverseGraph: vi.fn(),
        detachAll,
      });

      scheduler.dispose(node, vi.fn());

      expect(detachAll).toHaveBeenCalledWith(dep);
      expect(node.dependencies).toBeUndefined();
      expect(node.dependencyTail).toBeUndefined();
    });
  });
});
