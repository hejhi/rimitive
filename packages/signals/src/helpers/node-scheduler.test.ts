import { describe, it, expect, vi } from 'vitest';
import { createNodeScheduler } from './node-scheduler';
import { createBaseContext, type GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { STATUS_DISPOSED } = CONSTANTS;

describe('NodeScheduler', () => {
  // Helper to count nodes in queue
  const getQueueSize = (ctx: GlobalContext): number => {
    let count = 0;
    let node = ctx.queueHead;
    while (node) {
      count++;
      node = node.nextScheduled;
    }
    return count;
  };
  it('should enqueue nodes', () => {
    const ctx = createBaseContext();
    const helpers = createNodeScheduler(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      flags: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    helpers.enqueue(node);
    expect(getQueueSize(ctx)).toBe(1);
  });

  it('should not enqueue already scheduled nodes', () => {
    const ctx = createBaseContext();
    const helpers = createNodeScheduler(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      flags: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    // Enqueue once
    helpers.enqueue(node);
    expect(getQueueSize(ctx)).toBe(1);
    
    // Try to enqueue again - should be skipped
    helpers.enqueue(node);
    expect(getQueueSize(ctx)).toBe(1);
  });

  it('should dispose node only once', () => {
    const ctx = createBaseContext();
    const helpers = createNodeScheduler(ctx);
    
    const cleanupFn = vi.fn();
    const node: ScheduledNode = {
      __type: 'test',
      flags: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    helpers.dispose(node, cleanupFn);
    
    expect(node.flags & STATUS_DISPOSED).toBe(STATUS_DISPOSED);
    expect(cleanupFn).toHaveBeenCalledWith(node);
    
    // Try disposing again
    helpers.dispose(node, cleanupFn);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should flush all scheduled nodes in FIFO order', () => {
    const ctx = createBaseContext();
    const helpers = createNodeScheduler(ctx);
    
    const flush1 = vi.fn();
    const flush2 = vi.fn();
    const flush3 = vi.fn();
    
    const node1: ScheduledNode = {
      __type: 'test',
      flags: 1, // STATUS_PENDING
      nextScheduled: undefined,
      flush: flush1,
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    const node2: ScheduledNode = {
      __type: 'test',
      flags: 1, // STATUS_PENDING
      nextScheduled: undefined,
      flush: flush2,
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    const node3: ScheduledNode = {
      __type: 'test',
      flags: 1, // STATUS_PENDING
      nextScheduled: undefined,
      flush: flush3,
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    // Schedule nodes in order
    helpers.enqueue(node1);
    helpers.enqueue(node2);
    helpers.enqueue(node3);
    
    helpers.flush();
    
    expect(getQueueSize(ctx)).toBe(0);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
    
    // Verify they were flushed in FIFO order
    expect(flush1.mock.invocationCallOrder[0]!).toBeLessThan(flush2.mock.invocationCallOrder[0]!);
    expect(flush2.mock.invocationCallOrder[0]!).toBeLessThan(flush3.mock.invocationCallOrder[0]!);
  });

  it('should handle empty flush', () => {
    const ctx = createBaseContext();
    const helpers = createNodeScheduler(ctx);
    
    // Flush with no nodes queued - should not throw
    expect(() => helpers.flush()).not.toThrow();
    
    // State should remain unchanged
    expect(getQueueSize(ctx)).toBe(0);
    expect(ctx.queueHead).toBeUndefined();
  });

  it('should clear nextScheduled flag during flush', () => {
    const ctx = createBaseContext();
    const helpers = createNodeScheduler(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      flags: 0,
      nextScheduled: undefined,
      flush: vi.fn(),
      dependencies: undefined,
      dependencyTail: undefined,
      notify: vi.fn(),
    };
    
    helpers.enqueue(node);
    
    helpers.flush();
  });
});
