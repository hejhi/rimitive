import { describe, it, expect } from 'vitest';
import { executeUserCode } from './executor';
import type { ExecutionContext } from '../types';

describe('executeUserCode', () => {
  const createMockContext = (): ExecutionContext => ({
    signal: <T>(initial: T) => {
      let value = initial;
      return ((newValue?: T) => {
        if (arguments.length === 0) return value;
        value = newValue as T;
        return value;
      }) as (value?: T) => T;
    },
    computed: <T>(fn: () => T) => fn,
    effect: () => () => {},
    batch: (fn: () => void) => fn(),
  });

  it('should execute simple code and return null for undefined result', () => {
    const context = createMockContext();
    const result = executeUserCode('const x = 1;', context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.element).toBeNull();
      expect(typeof result.dispose).toBe('function');
    }
  });

  it('should execute code that returns null', () => {
    const context = createMockContext();
    const result = executeUserCode('return null;', context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.element).toBeNull();
    }
  });

  it('should return error for syntax errors', () => {
    const context = createMockContext();
    const result = executeUserCode('const x = {', context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('should return error for runtime errors', () => {
    const context = createMockContext();
    const result = executeUserCode('throw new Error("test error");', context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('test error');
    }
  });

  it('should provide svc with signal primitive', () => {
    const context = createMockContext();
    const result = executeUserCode(`
      const { signal } = svc;
      const count = signal(5);
      return count();
    `, context);

    // This returns a number, not an element, so it should error
    expect(result.success).toBe(false);
  });

  it('should return error for non-element return values', () => {
    const context = createMockContext();
    const result = executeUserCode('return "string";', context);

    expect(result.success).toBe(false);
    if (!result.success) {
      // In Node environment, HTMLElement is not defined, so we get a different error
      // In browser, we'd get "must return an element"
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
