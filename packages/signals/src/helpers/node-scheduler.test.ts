import { describe, it, expect, vi } from 'vitest';
import { createNodeScheduler } from './node-scheduler';
import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { STATUS_DISPOSED, STATUS_PENDING } = CONSTANTS;

describe('NodeScheduler', () => {
  it('should enqueue nodes', () => {
    const scheduler = createNodeScheduler();

    const node: ScheduledNode = {
      __type: 'test',
      status: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      isScheduled: false,
      notify: vi.fn(),
    };

    scheduler.startBatch();
    scheduler.enqueue(node);
    expect(node.isScheduled).toBe(true);
  });

  it('should not enqueue already scheduled nodes', () => {
    const scheduler = createNodeScheduler();

    const node: ScheduledNode = {
      __type: 'test',
      status: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      notify: vi.fn(),
    };

    // Enqueue once
    scheduler.enqueue(node);
    const scheduledAfterFirst = node.isScheduled;

    // Try to enqueue again - should be skipped
    scheduler.enqueue(node);
    expect(node.isScheduled).toBe(scheduledAfterFirst); // Scheduled flag unchanged
  });

  it('should dispose node only once', () => {
    const scheduler = createNodeScheduler();

    const cleanupFn = vi.fn();
    const node: ScheduledNode = {
      __type: 'test',
      status: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      notify: vi.fn(),
    };

    // First disposal
    scheduler.dispose(node, cleanupFn);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
    expect(node.status).toBe(STATUS_DISPOSED);

    // Second disposal - should be skipped
    scheduler.dispose(node, cleanupFn);
    expect(cleanupFn).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should flush all scheduled nodes in FIFO order', () => {
    const scheduler = createNodeScheduler();

    const flushOrder: string[] = [];

    const createNode = (id: string): ScheduledNode => ({
      __type: 'test',
      status: STATUS_PENDING, // STATUS_PENDING so it will flush
      nextScheduled: undefined,
      flush: vi.fn(() => flushOrder.push(id)),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      notify: vi.fn(),
    });

    const node1 = createNode('1');
    const node2 = createNode('2');
    const node3 = createNode('3');

    scheduler.startBatch();

    scheduler.enqueue(node1);
    scheduler.enqueue(node2);
    scheduler.enqueue(node3);

    scheduler.flush();

    expect(flushOrder).toEqual(['1', '2', '3']);
    expect(node1.flush).toHaveBeenCalledTimes(1);
    expect(node2.flush).toHaveBeenCalledTimes(1);
    expect(node3.flush).toHaveBeenCalledTimes(1);
  });

  it('should handle empty flush', () => {
    const scheduler = createNodeScheduler();

    // Should not throw
    expect(() => scheduler.flush()).not.toThrow();
  });

  it('should clear nextScheduled flag during flush', () => {
    const scheduler = createNodeScheduler();

    const node: ScheduledNode = {
      __type: 'test',
      status: STATUS_PENDING, // STATUS_PENDING so it will flush
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
      notify: vi.fn(),
      isScheduled: false
    };

    scheduler.startBatch();
    scheduler.enqueue(node);
    expect(node.isScheduled).toBe(true);

    scheduler.flush();

    expect(node.isScheduled).toBe(false);
    expect(node.nextScheduled).toBeUndefined();
  });

  it('should handle batch operations', () => {
    const scheduler = createNodeScheduler();

    expect(scheduler.inBatch()).toBe(false);

    scheduler.startBatch();
    expect(scheduler.inBatch()).toBe(true);

    scheduler.enterBatch(); // Nested
    expect(scheduler.inBatch()).toBe(true);

    scheduler.exitBatch(); // Exit one level of batching
    expect(scheduler.inBatch()).toBe(true); // Still in batch (nested)

    scheduler.exitBatch(); // Exit final batch level
    expect(scheduler.inBatch()).toBe(false);
  });
});