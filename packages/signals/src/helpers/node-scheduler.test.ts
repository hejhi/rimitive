import { describe, it, expect, vi } from 'vitest';
import { createNodeScheduler } from './node-scheduler';
import { CONSTANTS, STATUS_SCHEDULED } from '../constants';
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
    };

    scheduler.startBatch();
    scheduler.enqueue(node);
    expect(node.status).toBe(STATUS_SCHEDULED);
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
    };

    // Enqueue once
    scheduler.enqueue(node);
    const scheduledAfterFirst = node.status;

    // Try to enqueue again - should be skipped
    scheduler.enqueue(node);
    expect(node.status).toBe(scheduledAfterFirst); // Scheduled flag unchanged
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

    // Store mock functions separately to avoid unbound-method lint errors
    const flush1 = vi.fn(() => flushOrder.push('1'));
    const flush2 = vi.fn(() => flushOrder.push('2'));
    const flush3 = vi.fn(() => flushOrder.push('3'));

    const node1: ScheduledNode = {
      __type: 'test',
      status: STATUS_PENDING,
      nextScheduled: undefined,
      flush: flush1,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    const node2: ScheduledNode = {
      __type: 'test',
      status: STATUS_PENDING,
      nextScheduled: undefined,
      flush: flush2,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    const node3: ScheduledNode = {
      __type: 'test',
      status: STATUS_PENDING,
      nextScheduled: undefined,
      flush: flush3,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    scheduler.startBatch();

    scheduler.enqueue(node1);
    scheduler.enqueue(node2);
    scheduler.enqueue(node3);

    scheduler.flush();

    expect(flushOrder).toEqual(['1', '2', '3']);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
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
    };

    scheduler.startBatch();
    scheduler.enqueue(node);
    expect(node.status === STATUS_SCHEDULED).toBe(true);

    scheduler.flush();

    expect(node.status === STATUS_SCHEDULED).toBe(false);
    expect(node.nextScheduled).toBeUndefined();
  });
});