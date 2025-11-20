import { describe, it, expect, vi } from 'vitest';
import { createAddEventListener } from './addEventListener';
import { createTestScheduler } from '../test-helpers';

describe('addEventListener', () => {
  it('should attach event listener and return unsubscribe function', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const element = document.createElement('button');
    const handler = vi.fn();

    const unsub = addEventListener('click', handler)(element);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsub();

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
  });

  it('should pass correct event type to handler', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const input = document.createElement('input');
    const handler = vi.fn();

    addEventListener('input', handler)(input);

    const event = new Event('input');
    input.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should support event listener options', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const element = document.createElement('div');
    const handler = vi.fn();

    const unsub = addEventListener('click', handler, { once: true })(element);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again due to { once: true }

    unsub();
  });

  it('should handle multiple listeners on same element', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const element = document.createElement('button');
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = addEventListener('click', handler1)(element);
    const unsub2 = addEventListener('click', handler2)(element);

    element.click();
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    unsub1();
    element.click();
    expect(handler1).toHaveBeenCalledTimes(1); // Should not be called
    expect(handler2).toHaveBeenCalledTimes(2); // Should still be called

    unsub2();
  });

  it('should be safe to call unsubscribe multiple times', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const element = document.createElement('button');
    const handler = vi.fn();

    const unsub = addEventListener('click', handler)(element);

    unsub();
    unsub(); // Should not throw
    unsub();

    element.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should wrap handler with batching', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const element = document.createElement('button');
    let batchDepthDuringHandler = -1;

    const handler = () => {
      batchDepthDuringHandler = scheduler.batchDepth;
    };

    addEventListener('click', handler)(element);

    expect(scheduler.batchDepth).toBe(0); // Before click

    element.click();

    expect(batchDepthDuringHandler).toBe(1); // During handler
    expect(scheduler.batchDepth).toBe(0); // After handler
  });

  it('should always call endBatch even if handler throws', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const element = document.createElement('button');
    const handler = () => {
      throw new Error('Handler error');
    };

    addEventListener('click', handler)(element);

    expect(scheduler.batchDepth).toBe(0);

    // Click should throw but batch should be cleaned up
    expect(() => element.click()).toThrow('Handler error');
    expect(scheduler.batchDepth).toBe(0); // Batch depth reset despite error
  });

  it('should support nested batching with multiple handlers', () => {
    const scheduler = createTestScheduler();
    const addEventListener = createAddEventListener((fn) =>
      scheduler.batch(fn)
    );

    const button1 = document.createElement('button');
    const button2 = document.createElement('button');

    let handler1BatchDepth = -1;
    let handler2BatchDepth = -1;

    const handler1 = () => {
      handler1BatchDepth = scheduler.batchDepth;
      // Trigger second button click from within first handler
      button2.dispatchEvent(new Event('click', { bubbles: false }));
    };

    const handler2 = () => {
      handler2BatchDepth = scheduler.batchDepth;
    };

    addEventListener('click', handler1)(button1);
    addEventListener('click', handler2)(button2);

    button1.dispatchEvent(new Event('click', { bubbles: false }));

    expect(handler1BatchDepth).toBe(1); // First handler at depth 1
    expect(handler2BatchDepth).toBe(2); // Second handler at depth 2 (nested)
    expect(scheduler.batchDepth).toBe(0); // Back to 0 after all handlers
  });
});
