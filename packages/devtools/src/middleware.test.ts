/**
 * @fileoverview Tests for DevTools middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLattice, createStore } from '@lattice/core';
import { withDevTools } from './middleware';
import { DevToolsAPIManager } from './events/api';
import { DEVTOOLS_WINDOW_KEY } from './constants';

describe('withDevTools middleware', () => {
  beforeEach(() => {
    // Clear window.__LATTICE_DEVTOOLS__ before each test
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>)[DEVTOOLS_WINDOW_KEY];
    }
    vi.clearAllMocks();
  });

  it('should initialize DevTools API on first use', () => {
    const context = createLattice();
    withDevTools()(context);
    
    const api = DevToolsAPIManager.getAPI();
    expect(api).toBeTruthy();
    expect(api?.enabled).toBe(true);
    expect(api?.version).toBe('1.0.0');
  });

  it('should emit CONTEXT_CREATED event', () => {
    const context = createLattice();
    withDevTools({ name: 'TestContext' })(context);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    const events = api.getEvents();

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('CONTEXT_CREATED');
    expect(events[0]!.data).toMatchObject({
      name: 'TestContext',
    });
  });

  it('should instrument signal creation and updates', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools()(context);

    const signal = instrumentedContext.signal(42);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    // Update signal
    signal.value = 100;

    const events = api.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('SIGNAL_WRITE');
    expect(events[0]!.data).toMatchObject({
      oldValue: 42,
      newValue: 100,
    });
  });

  it('should track signal reads when enabled', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools({ trackReads: true })(context);

    const signal = instrumentedContext.signal(42);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    // Read signal by accessing value
    void signal.value;

    const events = api.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('SIGNAL_READ');
    expect(events[0]!.data).toMatchObject({
      value: 42,
    });
  });

  it('should instrument computed creation', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools()(context);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    instrumentedContext.computed(() => 42);

    const events = api.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('COMPUTED_CREATED');
    expect(events[0]!.data).toBeTruthy();
  });

  it('should track computed executions when enabled', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools({ trackComputations: true })(
      context
    );

    let callCount = 0;
    const computed = instrumentedContext.computed(() => {
      callCount++;
      return callCount * 10;
    });

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    // Access computed to trigger execution
    void computed.value;

    const events = api.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);

    const startEvent = events.find((e) => e.type === 'COMPUTED_START');
    const endEvent = events.find((e) => e.type === 'COMPUTED_END');

    expect(startEvent).toBeTruthy();
    expect(endEvent).toBeTruthy();
    expect(endEvent?.data).toMatchObject({
      value: 10,
    });
  });

  it('should instrument effect creation and disposal', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools()(context);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    const effectFn = () => {
      // Effect body
    };
    const dispose = instrumentedContext.effect(effectFn);

    let events = api.getEvents();
    expect(events).toHaveLength(3); // CREATED, START, END
    const effectCreated = events.find((e) => e.type === 'EFFECT_CREATED');
    const effectStart = events.find((e) => e.type === 'EFFECT_START');
    const effectEnd = events.find((e) => e.type === 'EFFECT_END');
    expect(effectCreated).toBeTruthy();
    expect(effectStart).toBeTruthy();
    expect(effectEnd).toBeTruthy();

    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();
    
    // Dispose the effect
    if (typeof dispose === 'function') {
      dispose();
    } else {
      throw new Error('Effect dispose is not a function');
    }

    events = api.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('EFFECT_DISPOSED');
  });

  it('should track batch operations', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools()(context);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    let result = 0;
    instrumentedContext.batch(() => {
      result = 42;
    });

    expect(result).toBe(42);

    const events = api.getEvents();
    const batchStart = events.find((e) => e.type === 'BATCH_START');
    const batchEnd = events.find((e) => e.type === 'BATCH_END');
    expect(batchStart).toBeTruthy();
    expect(batchEnd).toBeTruthy();
    expect(batchEnd?.data).toMatchObject({
      success: true,
    });
  });

  it('should track batch errors', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools()(context);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    expect(() => {
      instrumentedContext.batch(() => {
        throw new Error('Batch error');
      });
    }).toThrow('Batch error');

    const events = api.getEvents();
    const batchEnd = events.find((e) => e.type === 'BATCH_END');
    expect(batchEnd).toBeTruthy();
    expect(batchEnd?.data).toMatchObject({
      success: false,
      error: 'Batch error',
    });
  });

  it('should work with createStore', () => {
    const instrumentedContext = withDevTools({ name: 'StoreTest' })(
      createLattice()
    );
    const store = createStore({ count: 0 }, instrumentedContext);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    const events = api.getEvents();

    // Should have context creation and signal creation for count
    const contextEvent = events.find((e) => e.type === 'CONTEXT_CREATED');
    const signalEvent = events.find((e) => e.type === 'SIGNAL_CREATED');

    expect(contextEvent).toBeTruthy();
    expect(signalEvent).toBeTruthy();

    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    // Update store
    store.set({ count: 10 });

    const updateEvents = api.getEvents();
    // Should have batch start, signal write, batch end
    expect(updateEvents.some((e) => e.type === 'BATCH_START')).toBe(true);
    expect(updateEvents.some((e) => e.type === 'SIGNAL_WRITE')).toBe(true);
    expect(updateEvents.some((e) => e.type === 'BATCH_END')).toBe(true);
  });

  it('should emit CONTEXT_DISPOSED on dispose', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools({ name: 'DisposableContext' })(
      context
    );

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    instrumentedContext.dispose();

    const events = api.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('CONTEXT_DISPOSED');
    expect(events[0]?.data).toMatchObject({
      name: 'DisposableContext',
    });
  });

  it('should limit event buffer size', () => {
    const context = createLattice();
    const instrumentedContext = withDevTools()(context);

    const api = DevToolsAPIManager.getAPI();
    if (!api) throw new Error('DevTools API not initialized');
    api.clearEvents();

    // Create many signals to exceed buffer
    for (let i = 0; i < 10100; i++) {
      instrumentedContext.signal(i);
    }

    const events = api.getEvents();
    expect(events.length).toBeLessThanOrEqual(10000);
  });
});
