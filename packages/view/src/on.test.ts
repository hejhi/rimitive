import { describe, it, expect, vi } from 'vitest';
import { createOnFactory, createListenerFactory } from './on';
import { createTestScheduler } from './test-helpers';
import { RefSpec, STATUS_REF_SPEC } from './types';

describe('on', () => {
  it('should attach event listener and return unsubscribe function', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

    const element = document.createElement('button');
    const handler = vi.fn();

    const unsub = on('click', handler)(element);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsub();

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
  });

  it('should pass correct event type to handler', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

    const input = document.createElement('input');
    const handler = vi.fn();

    on('input', handler)(input);

    const event = new Event('input');
    input.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should support event listener options', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

    const element = document.createElement('div');
    const handler = vi.fn();

    const unsub = on('click', handler, { once: true })(element);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again due to { once: true }

    unsub();
  });

  it('should handle multiple listeners on same element', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

    const element = document.createElement('button');
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = on('click', handler1)(element);
    const unsub2 = on('click', handler2)(element);

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
    const { method: on } = createOnFactory(scheduler);

    const element = document.createElement('button');
    const handler = vi.fn();

    const unsub = on('click', handler)(element);

    unsub();
    unsub(); // Should not throw
    unsub();

    element.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should wrap handler with batching', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

    const element = document.createElement('button');
    let batchDepthDuringHandler = -1;

    const handler = () => {
      batchDepthDuringHandler = scheduler.batchDepth;
    };

    on('click', handler)(element);

    expect(scheduler.batchDepth).toBe(0); // Before click

    element.click();

    expect(batchDepthDuringHandler).toBe(1); // During handler
    expect(scheduler.batchDepth).toBe(0); // After handler
  });

  it('should always call endBatch even if handler throws', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

    const element = document.createElement('button');
    const handler = () => {
      throw new Error('Handler error');
    };

    on('click', handler)(element);

    expect(scheduler.batchDepth).toBe(0);

    // Click should throw but batch should be cleaned up
    expect(() => element.click()).toThrow('Handler error');
    expect(scheduler.batchDepth).toBe(0); // Batch depth reset despite error
  });

  it('should support nested batching with multiple handlers', () => {
    const scheduler = createTestScheduler();
    const { method: on } = createOnFactory(scheduler);

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

    on('click', handler1)(button1);
    on('click', handler2)(button2);

    button1.dispatchEvent(new Event('click', { bubbles: false }));

    expect(handler1BatchDepth).toBe(1); // First handler at depth 1
    expect(handler2BatchDepth).toBe(2); // Second handler at depth 2 (nested)
    expect(scheduler.batchDepth).toBe(0); // Back to 0 after all handlers
  });
});

describe('listener', () => {
  it('should attach multiple listeners with single cleanup', () => {
    const scheduler = createTestScheduler();
    const { method: listener } = createListenerFactory(scheduler);

    const element = document.createElement('input');
    const inputHandler = vi.fn();
    const keydownHandler = vi.fn();
    let cleanup: (() => void) | undefined;

    // Mock element ref pattern
    function createMockRef(el: HTMLInputElement): RefSpec<HTMLInputElement> {
      const ref: RefSpec<HTMLInputElement> = (callback: (element: HTMLInputElement) => void | (() => void)) => {
        cleanup = callback(el) as (() => void) | undefined;
        return ref;
      };
      ref.status = STATUS_REF_SPEC;
      ref.create = () => ({ status: 1, element: el, next: undefined });
      return ref;
    }
    const elementRef = createMockRef(element);

    listener(elementRef, (on) => {
      on('input', inputHandler);
      on('keydown', keydownHandler);
    });

    // Trigger events
    element.dispatchEvent(new Event('input'));
    element.dispatchEvent(new KeyboardEvent('keydown'));

    expect(inputHandler).toHaveBeenCalledTimes(1);
    expect(keydownHandler).toHaveBeenCalledTimes(1);

    // Cleanup all listeners
    if (cleanup) cleanup();

    element.dispatchEvent(new Event('input'));
    element.dispatchEvent(new KeyboardEvent('keydown'));

    expect(inputHandler).toHaveBeenCalledTimes(1); // Should not increase
    expect(keydownHandler).toHaveBeenCalledTimes(1); // Should not increase
  });

  it('should support listener options', () => {
    const scheduler = createTestScheduler();
    const { method: listener } = createListenerFactory(scheduler);

    const element = document.createElement('button');
    const handler = vi.fn();
    let cleanup: (() => void) | undefined;

    function createMockRef(el: HTMLButtonElement): RefSpec<HTMLButtonElement> {
      const ref: RefSpec<HTMLButtonElement> = (callback) => {
        cleanup = callback(el) as (() => void) | undefined;
        return ref;
      };
      ref.status = STATUS_REF_SPEC;
      ref.create = () => ({ status: 1, element: el, next: undefined });
      return ref;
    }
    const elementRef = createMockRef(element);

    listener(elementRef, (on) => {
      on('click', handler, { once: true });
    });

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again

    if (cleanup) cleanup();
  });

  it('should return RefSpec allowing chained lifecycle callbacks', () => {
    const scheduler = createTestScheduler();
    const { method: listener } = createListenerFactory(scheduler);

    const element = document.createElement('input');
    const inputHandler = vi.fn();
    const connectHandler = vi.fn();
    let cleanup1: (() => void) | undefined;
    let cleanup2: (() => void) | undefined;

    function createMockRef(el: HTMLInputElement): RefSpec<HTMLInputElement> {
      const ref: RefSpec<HTMLInputElement> = (callback) => {
        const result = callback(el) as (() => void) | undefined;
        if (!cleanup1) cleanup1 = result;
        else cleanup2 = result;
        return ref;
      };
      ref.status = STATUS_REF_SPEC;
      ref.create = () => ({ status: 1, element: el, next: undefined });
      return ref;
    }
    const elementRef = createMockRef(element);

    // Use listener helper
    const ref = listener(elementRef, (on) => {
      on('input', inputHandler);
    });

    // Chain another lifecycle callback on the returned ref
    ref((el) => {
      connectHandler(el);
    });

    expect(connectHandler).toHaveBeenCalledWith(element);

    element.dispatchEvent(new Event('input'));
    expect(inputHandler).toHaveBeenCalledTimes(1);

    // Cleanup both
    if (cleanup1) cleanup1();
    if (cleanup2) cleanup2();

    element.dispatchEvent(new Event('input'));
    expect(inputHandler).toHaveBeenCalledTimes(1); // Should not increase
  });

  it('should wrap handlers with batching in listener', () => {
    const scheduler = createTestScheduler();
    const { method: listener } = createListenerFactory(scheduler);

    const element = document.createElement('input');
    let batchDepthDuringHandler = -1;

    function createMockRef(el: HTMLInputElement): RefSpec<HTMLInputElement> {
      const ref: RefSpec<HTMLInputElement> = (callback) => {
        callback(el);
        return ref;
      };
      ref.status = STATUS_REF_SPEC;
      ref.create = () => ({ status: 1, element: el, next: undefined });
      return ref;
    }
    const elementRef = createMockRef(element);

    listener(elementRef, (on) => {
      on('input', () => {
        batchDepthDuringHandler = scheduler.batchDepth;
      });
    });

    expect(scheduler.batchDepth).toBe(0); // Before event

    element.dispatchEvent(new Event('input'));

    expect(batchDepthDuringHandler).toBe(1); // During handler
    expect(scheduler.batchDepth).toBe(0); // After handler
  });
});

