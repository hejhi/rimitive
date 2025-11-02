/**
 * Tests for lifecycle combinators
 */

import { describe, it, expect, vi } from 'vitest';
import {
  identity,
  seq,
  seqAll,
  pipe,
  lazy,
  curry,
} from './combinators';
import type { RefSpec, LifecycleCallback } from './types';
import { STATUS_REF_SPEC } from './types';

// Mock RefSpec for testing
function mockRefSpec<T>(): RefSpec<T> {
  const callbacks: LifecycleCallback<T>[] = [];

  const refSpec: RefSpec<T> = (callback) => {
    callbacks.push(callback);
    return refSpec;
  };

  refSpec.status = STATUS_REF_SPEC;
  refSpec.create = () => {
    throw new Error('Not implemented in test mock');
  };

  // Helper to execute all callbacks with an element
  (refSpec as unknown as Record<string, unknown>).executeCallbacks = (element: T) => {
    const cleanups = callbacks.map(cb => cb(element)).filter(Boolean);
    return () => cleanups.forEach(cleanup => cleanup?.());
  };

  return refSpec;
}

describe('identity', () => {
  it('should return a no-op callback', () => {
    const callback = identity<HTMLElement>();
    const div = document.createElement('div');
    const cleanup = callback(div);
    expect(cleanup).toBeUndefined();
  });
});

describe('seq', () => {
  it('should run both callbacks in sequence', () => {
    const calls: string[] = [];
    const first: LifecycleCallback<HTMLElement> = (_el) => {
      calls.push('first');
    };
    const second: LifecycleCallback<HTMLElement> = (_el) => {
      calls.push('second');
    };

    const composed = seq(first, second);
    const div = document.createElement('div');
    composed(div);

    expect(calls).toEqual(['first', 'second']);
  });

  it('should compose cleanup functions', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const first: LifecycleCallback<HTMLElement> = () => cleanup1;
    const second: LifecycleCallback<HTMLElement> = () => cleanup2;

    const composed = seq(first, second);
    const div = document.createElement('div');
    const composedCleanup = composed(div);

    expect(composedCleanup).toBeDefined();
    composedCleanup!();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  it('should optimize when no cleanups exist', () => {
    const first: LifecycleCallback<HTMLElement> = () => {};
    const second: LifecycleCallback<HTMLElement> = () => {};

    const composed = seq(first, second);
    const div = document.createElement('div');
    const cleanup = composed(div);

    expect(cleanup).toBeUndefined();
  });

  it('should optimize when only one cleanup exists', () => {
    const cleanup1 = vi.fn();
    const first: LifecycleCallback<HTMLElement> = () => cleanup1;
    const second: LifecycleCallback<HTMLElement> = () => {};

    const composed = seq(first, second);
    const div = document.createElement('div');
    const cleanup = composed(div);

    expect(cleanup).toBe(cleanup1);
  });
});

describe('seqAll', () => {
  it('should compose multiple callbacks', () => {
    const calls: string[] = [];
    const callbacks: LifecycleCallback<HTMLElement>[] = [
      () => { calls.push('a'); },
      () => { calls.push('b'); },
      () => { calls.push('c'); },
    ];

    const composed = seqAll(...callbacks);
    const div = document.createElement('div');
    composed(div);

    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('should handle empty array', () => {
    const composed = seqAll();
    const div = document.createElement('div');
    const cleanup = composed(div);

    expect(cleanup).toBeUndefined();
  });
});

describe('pipe', () => {
  it('should chain callbacks onto a RefSpec', () => {
    const refSpec = mockRefSpec<HTMLElement>();
    const calls: string[] = [];

    const piped = pipe(
      refSpec,
      () => { calls.push('a'); },
      () => { calls.push('b'); }
    );

    const div = document.createElement('div');
    const executeCallbacks = (piped as unknown as Record<string, (el: HTMLElement) => void>).executeCallbacks;
    if (executeCallbacks) {
      executeCallbacks(div);
    }

    expect(calls).toEqual(['a', 'b']);
  });

  it('should return refSpec unchanged if no callbacks', () => {
    const refSpec = mockRefSpec<HTMLElement>();
    const piped = pipe(refSpec);

    expect(piped).toBe(refSpec);
  });
});

describe('lazy', () => {
  it('should defer factory execution until first call', () => {
    const factory = vi.fn((): LifecycleCallback<HTMLElement> =>
      () => { /* setup */ }
    );

    const lazyCallback = lazy(factory);
    expect(factory).not.toHaveBeenCalled();

    const div = document.createElement('div');
    lazyCallback(div);
    expect(factory).toHaveBeenCalledTimes(1);

    lazyCallback(div);
    expect(factory).toHaveBeenCalledTimes(1); // Still only once
  });
});

describe('curry', () => {
  it('should call function directly when all args provided', () => {
    const fn = vi.fn((a: number, b: string, el: HTMLElement) => {
      return `${a}-${b}-${el.tagName}`;
    });

    const curried = curry(fn);
    const div = document.createElement('div');
    const result = curried(1, 'test', div);

    expect(result).toBe('1-test-DIV');
    expect(fn).toHaveBeenCalledWith(1, 'test', div);
  });

  it('should return lifecycle callback when one arg short', () => {
    const fn = vi.fn((a: number, b: string, el: HTMLElement) => {
      return `${a}-${b}-${el.tagName}`;
    });

    const curried = curry(fn);
    const div = document.createElement('div');

    const callback = curried(1, 'test') as LifecycleCallback<HTMLElement>;
    expect(typeof callback).toBe('function');

    const result = callback(div);
    expect(result).toBe('1-test-DIV');
    expect(fn).toHaveBeenCalledWith(1, 'test', div);
  });

  it('should support progressive currying', () => {
    const fn = vi.fn((a: number, b: string, c: boolean, el: HTMLElement) => {
      return `${a}-${b}-${c}-${el.tagName}`;
    });

    const curried = curry(fn);
    const div = document.createElement('div');

    // Curry one arg at a time
    const step1 = curried(1) as typeof curried;
    expect(typeof step1).toBe('function');

    const step2 = step1('test') as typeof curried;
    expect(typeof step2).toBe('function');

    const callback = step2(true) as LifecycleCallback<HTMLElement>;
    expect(typeof callback).toBe('function');

    const result = callback(div);
    expect(result).toBe('1-test-true-DIV');
    expect(fn).toHaveBeenCalledWith(1, 'test', true, div);
  });

  it('should support partial application with multiple args', () => {
    const fn = vi.fn((a: number, b: string, c: boolean, el: HTMLElement) => {
      return `${a}-${b}-${c}-${el.tagName}`;
    });

    const curried = curry(fn);
    const div = document.createElement('div');

    // Apply 2 args at once
    const partial = curried(1, 'test') as typeof curried;
    const callback = partial(true) as LifecycleCallback<HTMLElement>;
    const result = callback(div);

    expect(result).toBe('1-test-true-DIV');
  });

  it('should work with event listener pattern', () => {
    const handler = vi.fn();

    const on = curry((event: string, h: typeof handler, el: HTMLElement) => {
      el.addEventListener(event, h);
      return () => el.removeEventListener(event, h);
    });

    const button = document.createElement('button');

    // Curried style (point-free)
    const callback = on('click', handler) as LifecycleCallback<HTMLElement>;
    const cleanup = callback(button) as () => void;

    button.click();
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
    button.click();
    expect(handler).toHaveBeenCalledTimes(1); // Not called again after cleanup
  });

  it('should respect explicit arity parameter', () => {
    // Function with rest parameters
    const fn = vi.fn((...args: unknown[]) => {
      const el = args[args.length - 1] as HTMLElement;
      const params = args.slice(0, -1);
      return `${params.join('-')}-${el.tagName}`;
    });

    // Specify arity of 3 (2 params + element)
    const curried = curry(fn, 3);
    const div = document.createElement('div');

    const callback = curried(1, 'test') as LifecycleCallback<HTMLElement>;
    const result = callback(div);

    expect(result).toBe('1-test-DIV');
  });
});
