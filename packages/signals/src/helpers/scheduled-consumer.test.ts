import { describe, it, expect, vi } from 'vitest';
import { createScheduledConsumerHelpers } from './scheduled-consumer';
import { createContext } from '../context';
import { CONSTANTS } from '../constants';
import type { ScheduledNode, StatefulNode } from '../types';

const { NOTIFIED, DISPOSED } = CONSTANTS;

describe('ScheduledConsumerHelpers', () => {
  it('should schedule consumers when batching', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    const consumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    ctx.batchDepth = 1;
    helpers.scheduleConsumer(consumer);
    
    expect(ctx.scheduledQueue![ctx.scheduledHead & ctx.scheduledMask]).toBe(consumer);
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(1);
    expect(consumer._nextScheduled).toBe(consumer); // Used as a flag
  });

  it('should invalidate consumer immediately when not batching', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    const consumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    ctx.batchDepth = 0;
    helpers.invalidateConsumer(consumer, NOTIFIED, NOTIFIED);
    
    expect(consumer._flags & NOTIFIED).toBe(NOTIFIED);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(consumer._flush).toHaveBeenCalled();
  });

  it('should schedule consumer when batching during invalidate', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    const consumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    ctx.batchDepth = 1;
    helpers.invalidateConsumer(consumer, NOTIFIED, NOTIFIED);
    
    expect(consumer._flags & NOTIFIED).toBe(NOTIFIED);
    expect(ctx.scheduledQueue![ctx.scheduledHead & ctx.scheduledMask]).toBe(consumer);
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(consumer._flush).not.toHaveBeenCalled();
  });

  it('should skip invalidation if check flags are set', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    const consumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: NOTIFIED,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.invalidateConsumer(consumer, NOTIFIED, NOTIFIED);
    
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(consumer._flush).not.toHaveBeenCalled();
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(0);
  });

  it('should dispose consumer only once', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    const cleanupFn = vi.fn();
    const consumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.disposeConsumer(consumer, cleanupFn);
    
    expect(consumer._flags & DISPOSED).toBe(DISPOSED);
    expect(cleanupFn).toHaveBeenCalledWith(consumer);
    
    // Try disposing again
    helpers.disposeConsumer(consumer, cleanupFn);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should flush all scheduled consumers', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    const flush1 = vi.fn();
    const flush2 = vi.fn();
    const flush3 = vi.fn();
    
    const consumer1: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush1,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    const consumer2: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush2,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    const consumer3: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush3,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    // Schedule consumers in order
    helpers.scheduleConsumer(consumer1);
    helpers.scheduleConsumer(consumer2);
    helpers.scheduleConsumer(consumer3);
    
    helpers.flushScheduled();
    
    expect(ctx.scheduledTail - ctx.scheduledHead).toBe(0);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
  });

  it('should throw on queue overflow', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    // Fill the queue to capacity
    for (let i = 0; i < 256; i++) {
      const consumer: ScheduledNode & StatefulNode = {
        __type: 'test',
        _flags: 0,
        _nextScheduled: undefined,
        _flush: vi.fn(),
        _invalidate: vi.fn(),
        _sources: undefined,
        dispose: () => {},
        _refresh: () => true
      };
      helpers.scheduleConsumer(consumer);
    }
    
    // The 257th consumer should cause an overflow error
    const overflowConsumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true
    };
    
    expect(() => helpers.scheduleConsumer(overflowConsumer)).toThrow(/Effect queue overflow: 256 effects scheduled/);
  });

  it('should reset queue counters to prevent integer overflow', () => {
    const ctx = createContext();
    const helpers = createScheduledConsumerHelpers(ctx);
    
    // Set tail close to overflow threshold
    ctx.scheduledTail = 0x7FFFFFF1;
    ctx.scheduledHead = 0x7FFFFFF1;
    
    // Schedule and flush a consumer
    const consumer: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: vi.fn(),
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
      _refresh: () => true,
    };
    
    helpers.scheduleConsumer(consumer);
    helpers.flushScheduled();
    
    // Should have reset to 0
    expect(ctx.scheduledHead).toBe(0);
    expect(ctx.scheduledTail).toBe(0);
  });
});