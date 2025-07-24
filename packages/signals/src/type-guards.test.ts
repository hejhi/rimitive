import { describe, it, expect } from 'vitest';
import { signal, computed } from './test-setup';
import { isSignal, isComputed, isEffect, isReactive } from './type-guards';

describe('Type Guards', () => {
  it('should correctly identify signals', () => {
    const sig = signal(42);
    expect(isSignal(sig)).toBe(true);
    expect(isComputed(sig)).toBe(false);
    expect(isEffect(sig)).toBe(false);
    expect(isReactive(sig)).toBe(true);
  });

  it('should correctly identify computed values', () => {
    const comp = computed(() => 42);
    expect(isSignal(comp)).toBe(false);
    expect(isComputed(comp)).toBe(true);
    expect(isEffect(comp)).toBe(false);
    expect(isReactive(comp)).toBe(true);
  });

  it('should correctly identify effects', () => {
    // Effects are internal and not directly exposed to users
    // We can test with a mock effect object that has the required shape
    const mockEffect = {
      __type: 'effect' as const,
      _fn: () => {},
      _flags: 0,
      _sources: undefined,
      _nextBatchedEffect: undefined,
      _notify: () => {},
      _run: () => {},
      dispose: () => {},
    };

    expect(isSignal(mockEffect)).toBe(false);
    expect(isComputed(mockEffect)).toBe(false);
    expect(isEffect(mockEffect)).toBe(true);
    expect(isReactive(mockEffect)).toBe(true);
  });

  it('should return false for non-reactive values', () => {
    expect(isSignal(null)).toBe(false);
    expect(isSignal(undefined)).toBe(false);
    expect(isSignal(42)).toBe(false);
    expect(isSignal('string')).toBe(false);
    expect(isSignal({})).toBe(false);
    expect(isSignal([])).toBe(false);
    expect(isSignal(() => {})).toBe(false);

    expect(isReactive(null)).toBe(false);
    expect(isReactive(undefined)).toBe(false);
    expect(isReactive(42)).toBe(false);
  });

  it('should handle objects with __type property that are not reactive', () => {
    const fakeSignal = { __type: 'signal', value: 42 };
    const fakeComputed = { __type: 'computed', value: 42 };
    const fakeEffect = { __type: 'effect' };

    // These should still return true because we're just checking __type
    // In practice, only real reactive primitives will have this property
    expect(isSignal(fakeSignal)).toBe(true);
    expect(isComputed(fakeComputed)).toBe(true);
    expect(isEffect(fakeEffect)).toBe(true);
  });
});
