import { describe, it, expect, vi } from 'vitest';
import { createWorkQueue } from './work-queue';
import { createContext } from '../context';
import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { DISPOSED, SCHEDULED } = CONSTANTS;

describe('WorkQueue', () => {
  it('should enqueue nodes', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    helpers.enqueue(node);
    expect(helpers.state.size).toBe(1);
    expect(node._flags & SCHEDULED).toBeTruthy(); // scheduled flag via bit
  });

  it('should not enqueue already scheduled nodes', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    // Enqueue once
    helpers.enqueue(node);
    expect(helpers.state.size).toBe(1);
    
    // Try to enqueue again - should be skipped
    helpers.enqueue(node);
    expect(helpers.state.size).toBe(1);
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
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    helpers.dispose(node, cleanupFn);
    
    expect(node._flags & DISPOSED).toBe(DISPOSED);
    expect(cleanupFn).toHaveBeenCalledWith(node);
    
    // Try disposing again
    helpers.dispose(node, cleanupFn);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should flush all scheduled nodes in FIFO order', () => {
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
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    const node2: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush2,
      _invalidate: vi.fn(),
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    const node3: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush3,
      _invalidate: vi.fn(),
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    // Schedule nodes in order
    helpers.enqueue(node1);
    helpers.enqueue(node2);
    helpers.enqueue(node3);
    
    helpers.flush();
    
    expect(helpers.state.size).toBe(0);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
    
    // Verify they were flushed in FIFO order
    expect(flush1.mock.invocationCallOrder[0]!).toBeLessThan(flush2.mock.invocationCallOrder[0]!);
    expect(flush2.mock.invocationCallOrder[0]!).toBeLessThan(flush3.mock.invocationCallOrder[0]!);
  });

  it('should handle empty flush', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    // Flush with no nodes queued - should not throw
    expect(() => helpers.flush()).not.toThrow();
    
    // State should remain unchanged
    expect(helpers.state.size).toBe(0);
    expect(ctx.queueHead).toBeUndefined();
  });

  it('should clear _nextScheduled flag during flush', () => {
    const ctx = createContext();
    const helpers = createWorkQueue(ctx);
    
    const node: ScheduledNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _from: undefined,
      _fromTail: undefined,
      dispose: () => {},
      _updateValue: () => true,
      _gen: 0,
    };
    
    helpers.enqueue(node);
    expect(node._flags & SCHEDULED).toBeTruthy(); // Check SCHEDULED bit is set
    
    helpers.flush();
    expect(node._flags & SCHEDULED).toBeFalsy(); // Check SCHEDULED bit is cleared
  });
});
