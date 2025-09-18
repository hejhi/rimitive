import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';
import { CONSTANTS, STATUS_SCHEDULED } from '../constants';
import type { ScheduledNode, FromNode } from '../types';

const { STATUS_DISPOSED } = CONSTANTS;

describe('NodeScheduler', () => {
  it('should schedule nodes during propagation', () => {
    const scheduler = createScheduler();

    const node: ScheduledNode = {
      __type: 'test',
      status: CONSTANTS.STATUS_CLEAN,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    // Create a dependency to trigger propagation
    const dependency = {
      consumer: node,
      nextConsumer: undefined,
      producer: {} as FromNode,
      prevConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
    };

    scheduler.startBatch();
    scheduler.propagate(dependency);
    expect(node.status).toBe(STATUS_SCHEDULED);
  });

  it('should not schedule already scheduled nodes', () => {
    const scheduler = createScheduler();

    const node: ScheduledNode = {
      __type: 'test',
      status: CONSTANTS.STATUS_CLEAN,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    const dependency = {
      consumer: node,
      nextConsumer: undefined,
      producer: {} as FromNode,
      prevConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
    };

    // Schedule once through propagation
    scheduler.startBatch();
    scheduler.propagate(dependency);
    const scheduledAfterFirst = node.status;
    expect(scheduledAfterFirst).toBe(STATUS_SCHEDULED);

    // Try to schedule again - should be skipped
    scheduler.propagate(dependency);
    expect(node.status).toBe(scheduledAfterFirst); // Status unchanged
  });

  it('should dispose node only once', () => {
    const scheduler = createScheduler();

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
    const scheduler = createScheduler();

    const flushOrder: string[] = [];

    // Store mock functions separately to avoid unbound-method lint errors
    const flush1 = vi.fn(() => flushOrder.push('1'));
    const flush2 = vi.fn(() => flushOrder.push('2'));
    const flush3 = vi.fn(() => flushOrder.push('3'));

    const node1: ScheduledNode = {
      __type: 'test',
      status: CONSTANTS.STATUS_CLEAN,
      nextScheduled: undefined,
      flush: flush1,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    const node2: ScheduledNode = {
      __type: 'test',
      status: CONSTANTS.STATUS_CLEAN,
      nextScheduled: undefined,
      flush: flush2,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    const node3: ScheduledNode = {
      __type: 'test',
      status: CONSTANTS.STATUS_CLEAN,
      nextScheduled: undefined,
      flush: flush3,
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    // Create dependencies to schedule nodes through propagation
    const dep1 = {
      consumer: node1,
      nextConsumer: undefined,
      producer: {} as FromNode,
      prevConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
    };

    const dep2 = {
      consumer: node2,
      nextConsumer: undefined,
      producer: {} as FromNode,
      prevConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
    };

    const dep3 = {
      consumer: node3,
      nextConsumer: undefined,
      producer: {} as FromNode,
      prevConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
    };

    // Schedule through propagation
    scheduler.propagate(dep1);
    scheduler.propagate(dep2);
    scheduler.propagate(dep3);

    scheduler.flush();

    expect(flushOrder).toEqual(['1', '2', '3']);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
  });

  it('should handle empty flush', () => {
    const scheduler = createScheduler();

    // Should not throw
    expect(() => scheduler.flush()).not.toThrow();
  });

  it('should clear nextScheduled flag during flush', () => {
    const scheduler = createScheduler();

    const node: ScheduledNode = {
      __type: 'test',
      status: CONSTANTS.STATUS_CLEAN, // Start clean so propagation processes it
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      deferredParent: undefined,
    };

    const dependency = {
      consumer: node,
      nextConsumer: undefined,
      producer: {} as FromNode,
      prevConsumer: undefined,
      prevDependency: undefined,
      nextDependency: undefined,
    };

    // Start batch to prevent auto-flush
    scheduler.startBatch();

    scheduler.propagate(dependency);
    expect(node.status === STATUS_SCHEDULED).toBe(true);
    expect(node.nextScheduled).toBeUndefined();

    // End batch to trigger flush
    scheduler.endBatch();

    // After flush, status should be reset
    expect(node.status === STATUS_SCHEDULED).toBe(false);
    expect(node.nextScheduled).toBeUndefined();
  });
});