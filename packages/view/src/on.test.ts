import { describe, it, expect, vi } from 'vitest';
import { on, listener } from './on';

describe('on', () => {
  it('should attach event listener and return unsubscribe function', () => {
    const element = document.createElement('button');
    const handler = vi.fn();

    const unsub = on(element, 'click', handler);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsub();

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
  });

  it('should pass correct event type to handler', () => {
    const input = document.createElement('input');
    const handler = vi.fn();

    on(input, 'input', handler);

    const event = new Event('input');
    input.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should support event listener options', () => {
    const element = document.createElement('div');
    const handler = vi.fn();

    const unsub = on(element, 'click', handler, { once: true });

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again due to { once: true }

    unsub();
  });

  it('should handle multiple listeners on same element', () => {
    const element = document.createElement('button');
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = on(element, 'click', handler1);
    const unsub2 = on(element, 'click', handler2);

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
    const element = document.createElement('button');
    const handler = vi.fn();

    const unsub = on(element, 'click', handler);

    unsub();
    unsub(); // Should not throw
    unsub();

    element.click();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('listener', () => {
  it('should attach multiple listeners with single cleanup', () => {
    const element = document.createElement('input');
    const inputHandler = vi.fn();
    const keydownHandler = vi.fn();
    let cleanup: (() => void) | undefined;

    // Mock element ref pattern
    const elementRef = (callback: (el: HTMLInputElement) => void | (() => void)) => {
      cleanup = callback(element) as (() => void) | undefined;
      return element;
    };

    listener(elementRef as any, (on) => {
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
    const element = document.createElement('button');
    const handler = vi.fn();
    let cleanup: (() => void) | undefined;

    const elementRef = (callback: (el: HTMLButtonElement) => void | (() => void)) => {
      cleanup = callback(element) as (() => void) | undefined;
      return element;
    };

    listener(elementRef as any, (on) => {
      on('click', handler, { once: true });
    });

    element.click();
    expect(handler).toHaveBeenCalledTimes(1);

    element.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again

    if (cleanup) cleanup();
  });

  it('should return ElementRef allowing chained lifecycle callbacks', () => {
    const element = document.createElement('input');
    const inputHandler = vi.fn();
    const connectHandler = vi.fn();
    let cleanup1: (() => void) | undefined;
    let cleanup2: (() => void) | undefined;

    const elementRef = (callback: (el: HTMLInputElement) => void | (() => void)) => {
      const result = callback(element) as (() => void) | undefined;
      if (!cleanup1) cleanup1 = result;
      else cleanup2 = result;
      return element;
    };

    // Use listener helper
    const ref = listener(elementRef as any, (on) => {
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
});
