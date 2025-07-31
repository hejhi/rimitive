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
    };
    
    ctx.batchDepth = 1;
    helpers.scheduleConsumer(consumer);
    
    expect(ctx.scheduledQueue[0]).toBe(consumer);
    expect(ctx.scheduledCount).toBe(1);
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
    };
    
    ctx.batchDepth = 1;
    helpers.invalidateConsumer(consumer, NOTIFIED, NOTIFIED);
    
    expect(consumer._flags & NOTIFIED).toBe(NOTIFIED);
    expect(ctx.scheduledQueue[0]).toBe(consumer);
    expect(ctx.scheduledCount).toBe(1);
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
    };
    
    helpers.invalidateConsumer(consumer, NOTIFIED, NOTIFIED);
    
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(consumer._flush).not.toHaveBeenCalled();
    expect(ctx.scheduledCount).toBe(0);
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
    };
    
    const consumer2: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush2,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
    };
    
    const consumer3: ScheduledNode & StatefulNode = {
      __type: 'test',
      _flags: 0,
      _nextScheduled: undefined,
      _flush: flush3,
      _invalidate: vi.fn(),
      _sources: undefined,
      dispose: () => {},
    };
    
    // Schedule consumers in order
    helpers.scheduleConsumer(consumer1);
    helpers.scheduleConsumer(consumer2);
    helpers.scheduleConsumer(consumer3);
    
    helpers.flushScheduled();
    
    expect(ctx.scheduledCount).toBe(0);
    expect(flush1).toHaveBeenCalledTimes(1);
    expect(flush2).toHaveBeenCalledTimes(1);
    expect(flush3).toHaveBeenCalledTimes(1);
  });
});