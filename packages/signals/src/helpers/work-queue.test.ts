import { describe, it, expect, vi } from 'vitest';
import { createWorkQueue } from './work-queue';
import { createContext } from '../context';
import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { NOTIFIED, DISPOSED } = CONSTANTS;

describe('WorkQueue', () => {
  it('should schedule nodes when batching', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      _generation: 0,
      dispose: () => {},
      _refresh: () => true,
    };
    
    ctx.batchDepth = 1;
    helpers.enqueue(node);
    
    expect(ctx.scheduledQueue![ctx.scheduledHead & ctx.scheduledMask]).toBe(node);
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(1);
    expect(node._nextScheduled).toBe(node); // Used as a flag
  });

  it('should invalidate node immediately when not batching', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      _generation: 0,
      dispose: () => {},
      _refresh: () => true,
    };
    
    ctx.batchDepth = 0;
    helpers.invalidate(node, NOTIFIED, NOTIFIED);
    
    expect(node._flags & NOTIFIED).toBe(NOTIFIED);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(node._flush).toHaveBeenCalled();
  });

  it('should schedule node when batching during invalidate', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      _generation: 0,
      dispose: () => {},
      _refresh: () => true,
    };
    
    ctx.batchDepth = 1;
    helpers.invalidate(node, NOTIFIED, NOTIFIED);
    
    expect(node._flags & NOTIFIED).toBe(NOTIFIED);
    expect(ctx.scheduledQueue![ctx.scheduledHead & ctx.scheduledMask]).toBe(node);
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(node._flush).not.toHaveBeenCalled();
  });

  it('should skip invalidation if check flags are set', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: NOTIFIED,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      _generation: 0,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.invalidate(node, NOTIFIED, NOTIFIED);
    
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(node._flush).not.toHaveBeenCalled();
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(0);
  });

  it('should dispose node only once', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const cleanupFn = vi.fn();
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      _generation: 0,
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

  it('should flush all scheduled nodes', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
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
      _generation: 0,
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
      _generation: 0,
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
      _generation: 0,
      dispose: () => {},
      _refresh: () => true,
    };
    
    // Schedule nodes in order
    helpers.enqueue(node1);
    helpers.enqueue(node2);
    helpers.enqueue(node3);
    
    helpers.flush();
    
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(0);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
  });

  it('should throw on queue overflow', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    // Fill the queue to capacity
    for (let i = 0; i < 256; i++) {
      const node: ScheduledNode = {
        __type: 'test',
        _flags: 0,
        _nextScheduled: undefined,
        _flush: vi.fn(),
        _invalidate: vi.fn(),
        _sources: undefined,
        _generation: 0,
        dispose: () => {},
        _refresh: () => true
      };
      helpers.enqueue(node);
    }
    
    // The 257th node should cause an overflow error
    const overflowNode: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _generation: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true
    };
    
    expect(() => helpers.enqueue(overflowNode)).toThrow(/Effect queue overflow: 256 effects scheduled/);
  });

  it('should reset queue counters to prevent integer overflow', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    // Set tail close to overflow threshold
    ctx.scheduledTail = 0x7FFFFFF1;
    ctx.scheduledHead = 0x7FFFFFF1;
    
    // Schedule and flush a node
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      _generation: 0,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.enqueue(node);
    helpers.flush();
    
    // Should have reset to 0
    expect(ctx.scheduledHead).toBe(0);
    expect(ctx.scheduledTail).toBe(0);
  });
});