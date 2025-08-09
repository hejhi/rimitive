import { describe, it, expect, vi } from 'vitest';
import { createWorkQueue } from './work-queue';
import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { DISPOSED } = CONSTANTS;

describe('WorkQueue', () => {
  it('should enqueue nodes', () => {
    const helpers = createWorkQueue();
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.enqueue(node);
    
    expect(helpers.state.queue![helpers.state.head & helpers.state.mask]).toBe(node);
    expect(helpers.state.tail - helpers.state.head).toBe(1);
    expect(node._nextScheduled).toBe(node); // Used as a flag
  });

  it('should not enqueue already scheduled nodes', () => {
    const helpers = createWorkQueue();
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    // Enqueue once
    helpers.enqueue(node);
    expect(helpers.state.tail - helpers.state.head).toBe(1);
    
    // Try to enqueue again - should be skipped
    helpers.enqueue(node);
    expect(helpers.state.tail - helpers.state.head).toBe(1);
  });

  it('should dispose node only once', () => {
    const helpers = createWorkQueue();
    
    const cleanupFn = vi.fn();
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.dispose(node, cleanupFn);
    
    expect(node._flags & DISPOSED).toBe(DISPOSED);
    expect(cleanupFn).toHaveBeenCalledWith(node);
    
    // Try disposing again
    helpers.dispose(node, cleanupFn);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should flush all scheduled nodes in reverse order', () => {
    const helpers = createWorkQueue();
    
    const flush1 = vi.fn();
    const flush2 = vi.fn();
    const flush3 = vi.fn();
    
    const node1: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush1,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    const node2: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush2,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    const node3: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush3,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    // Schedule nodes in order
    helpers.enqueue(node1);
    helpers.enqueue(node2);
    helpers.enqueue(node3);
    
    helpers.flush();
    
    expect(helpers.state.tail - helpers.state.head).toBe(0);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
    
    // Verify they were flushed in reverse order (LIFO)
    expect(flush3.mock.invocationCallOrder[0]!).toBeLessThan(flush2.mock.invocationCallOrder[0]!);
    expect(flush2.mock.invocationCallOrder[0]!).toBeLessThan(flush1.mock.invocationCallOrder[0]!);
  });

  it('should throw on queue overflow', () => {
    const helpers = createWorkQueue();
    
    // Fill the queue to capacity
    for (let i = 0; i < 256; i++) {
      const node: ScheduledNode = {
        __type: 'test',
        _flags: 0,
        _nextScheduled: undefined,
        _flush: vi.fn(),
        _invalidate: vi.fn(),
        _sources: undefined,
        dispose: () => {},
        _refresh: () => true
      };
      helpers.enqueue(node);
    }
    
    // The 257th node should cause an overflow error
    const overflowNode: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true
    };
    
    expect(() => helpers.enqueue(overflowNode)).toThrow(/Queue overflow: 256/);
  });

  it('should reset queue counters to prevent integer overflow', () => {
    const helpers = createWorkQueue();
    
    // Set tail close to overflow threshold
    helpers.state.tail = 0x7FFFFFF1;
    helpers.state.head = 0x7FFFFFF1;
    
    // Schedule and flush a node
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.enqueue(node);
    helpers.flush();
    
    // Should have reset to 0
    expect(helpers.state.head).toBe(0);
    expect(helpers.state.tail).toBe(0);
  });

  it('should handle empty flush', () => {
    const helpers = createWorkQueue();
    
    // Flush with no nodes queued - should not throw
    expect(() => helpers.flush()).not.toThrow();
    
    // State should remain unchanged
    expect(helpers.state.tail).toBe(0);
    expect(helpers.state.head).toBe(0);
  });

  it('should clear _nextScheduled flag during flush', () => {
    const helpers = createWorkQueue();
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.enqueue(node);
    expect(node._nextScheduled).toBe(node);
    
    helpers.flush();
    expect(node._nextScheduled).toBeUndefined();
  });
});
