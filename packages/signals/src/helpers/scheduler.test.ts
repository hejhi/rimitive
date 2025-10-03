import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';
import type { ScheduledNode, Dependency, ConsumerNode } from '../types';
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
      status: CONSUMER_PENDING,
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

  describe('Queue Management', () => {
    it('should queue nodes in FIFO order', () => {
      const order: string[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node1 = createMockScheduledNode();
        node1.flush = vi.fn(() => order.push('A'));
        const node2 = createMockScheduledNode();
        node2.flush = vi.fn(() => order.push('B'));
        const node3 = createMockScheduledNode();
        node3.flush = vi.fn(() => order.push('C'));

        onLeaf(node1);
        onLeaf(node2);
        onLeaf(node3);
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      const dep = createMockDependency();
      scheduler.propagate(dep);

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('should not queue nodes without flush method', () => {
      let queued = 0;
      const mockPropagate = vi.fn((_, onLeaf) => {
        const consumer = { status: CONSUMER_PENDING } as ConsumerNode;
        onLeaf(consumer);
        queued++;
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      const dep = createMockDependency();
      scheduler.propagate(dep);

      // Consumer without flush should not be queued
      expect(queued).toBe(1);
    });

    it('should only queue CONSUMER_PENDING nodes', () => {
      const executed: string[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node1 = createMockScheduledNode();
        node1.status = CONSUMER_PENDING;
        node1.flush = vi.fn(() => executed.push('pending'));

        const node2 = createMockScheduledNode();
        node2.status = STATUS_CLEAN;
        node2.flush = vi.fn(() => executed.push('clean'));

        const node3 = createMockScheduledNode();
        node3.status = SCHEDULED;
        node3.flush = vi.fn(() => executed.push('already-scheduled'));

        onLeaf(node1);
        onLeaf(node2);
        onLeaf(node3);
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.propagate(createMockDependency());

      // Only CONSUMER_PENDING should be queued and executed
      expect(executed).toEqual(['pending']);
    });
  });

  describe('Batch Management', () => {
    it('should increment batch depth on startBatch', () => {
      const scheduler = createScheduler({
        propagate: vi.fn(),
        detachAll: vi.fn(),
      });

      // startBatch uses post-increment, returns old value
      expect(scheduler.startBatch()).toBe(0); // was 0, now 1
      expect(scheduler.startBatch()).toBe(1); // was 1, now 2
      expect(scheduler.startBatch()).toBe(2); // was 2, now 3
    });

    it('should decrement batch depth on endBatch', () => {
      const scheduler = createScheduler({
        propagate: vi.fn(),
        detachAll: vi.fn(),
      });

      scheduler.startBatch(); // 1
      scheduler.startBatch(); // 2
      expect(scheduler.endBatch()).toBe(1);
      expect(scheduler.endBatch()).toBe(0);
    });

    it('should not flush during batch', () => {
      const executed: string[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node = createMockScheduledNode();
        node.flush = vi.fn(() => executed.push('flushed'));
        onLeaf(node);
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.startBatch();
      scheduler.propagate(createMockDependency());

      // Should not flush yet
      expect(executed).toEqual([]);

      scheduler.endBatch();

      // Should flush after batch ends
      expect(executed).toEqual(['flushed']);
    });

    it('should flush only when batch depth reaches 0', () => {
      const executed: string[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node = createMockScheduledNode();
        node.flush = vi.fn(() => executed.push('flushed'));
        onLeaf(node);
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.startBatch(); // depth = 1
      scheduler.startBatch(); // depth = 2
      scheduler.propagate(createMockDependency());
      expect(executed).toEqual([]);

      scheduler.endBatch(); // depth = 1
      expect(executed).toEqual([]);

      scheduler.endBatch(); // depth = 0
      expect(executed).toEqual(['flushed']);
    });

    it('should handle manual flush', () => {
      const executed: string[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node = createMockScheduledNode();
        node.flush = vi.fn(() => executed.push('flushed'));
        onLeaf(node);
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.startBatch();
      scheduler.propagate(createMockDependency());
      expect(executed).toEqual([]);

      // Manual flush should not work during batch
      scheduler.flush();
      expect(executed).toEqual([]);

      scheduler.endBatch();
      expect(executed).toEqual(['flushed']);
    });
  });

  describe('Status Transitions', () => {
    it('should transition CONSUMER_PENDING -> SCHEDULED -> STATUS_CLEAN', () => {
      const statuses: number[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node = createMockScheduledNode();
        node.status = CONSUMER_PENDING;
        statuses.push(node.status);

        onLeaf(node);
        statuses.push(node.status); // After queueing

        // Simulate flush callback
        node.flush = vi.fn(() => {
          statuses.push(node.status); // During flush
        });
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.propagate(createMockDependency());

      expect(statuses).toContain(CONSUMER_PENDING);
      expect(statuses).toContain(SCHEDULED);
      expect(statuses).toContain(STATUS_CLEAN);
    });

    it('should skip disposed nodes during flush', () => {
      const executed: string[] = [];
      const mockPropagate = vi.fn((_, onLeaf) => {
        const node1 = createMockScheduledNode();
        node1.flush = vi.fn(() => executed.push('A'));

        const node2 = createMockScheduledNode();
        node2.flush = vi.fn(() => executed.push('B'));
        node2.status = SCHEDULED_DISPOSED; // Disposed before flush

        const node3 = createMockScheduledNode();
        node3.flush = vi.fn(() => executed.push('C'));

        onLeaf(node1);
        onLeaf(node2);
        onLeaf(node3);

        // Manually set node2 as disposed after queueing
        node2.status = SCHEDULED_DISPOSED;
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.propagate(createMockDependency());

      // B should be skipped
      expect(executed).toEqual(['A', 'C']);
    });
  });

  describe('Error Isolation', () => {
    it('should continue executing after error', () => {
      const executed: string[] = [];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockPropagate = vi.fn((_, onLeaf) => {
        const node1 = createMockScheduledNode();
        node1.flush = vi.fn(() => executed.push('A'));

        const node2 = createMockScheduledNode();
        node2.flush = vi.fn(() => {
          throw new Error('Test error');
        });

        const node3 = createMockScheduledNode();
        node3.flush = vi.fn(() => executed.push('C'));

        onLeaf(node1);
        onLeaf(node2);
        onLeaf(node3);
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.propagate(createMockDependency());

      expect(executed).toContain('A');
      expect(executed).toContain('C');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Re-entrance', () => {
    it('should handle nodes scheduling more nodes during flush', () => {
      const order: string[] = [];
      let secondPropagation = false;

      const mockPropagate = vi.fn((_, onLeaf) => {
        if (!secondPropagation) {
          // First propagation
          const node1 = createMockScheduledNode();
          node1.flush = vi.fn(() => {
            order.push('outer');
            // Trigger another propagation during flush
            secondPropagation = true;
            scheduler.propagate(createMockDependency());
          });
          onLeaf(node1);
        } else {
          // Second propagation (triggered during flush)
          const node2 = createMockScheduledNode();
          node2.flush = vi.fn(() => order.push('inner'));
          onLeaf(node2);
        }
      });

      const scheduler = createScheduler({
        propagate: mockPropagate,
        detachAll: vi.fn(),
      });

      scheduler.propagate(createMockDependency());

      expect(order).toEqual(['outer', 'inner']);
    });
  });

  describe('Disposal', () => {
    it('should mark node as disposed', () => {
      const node = createMockScheduledNode();
      const cleanup = vi.fn();
      const detachAll = vi.fn();

      const scheduler = createScheduler({
        propagate: vi.fn(),
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
        propagate: vi.fn(),
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
        propagate: vi.fn(),
        detachAll,
      });

      scheduler.dispose(node, vi.fn());

      expect(detachAll).toHaveBeenCalledWith(dep);
      expect(node.dependencies).toBeUndefined();
      expect(node.dependencyTail).toBeUndefined();
    });
  });
});
