import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, resetGlobalState } from '../test-setup';

/**
 * Basic propagation, conditional branches, and error handling
 *
 * Tests fundamental propagation behavior:
 * - Lazy branches with conditional dependencies
 * - Error recovery and graph consistency
 * - Basic computed propagation through chains
 *
 * From alien-signals topology suite.
 */

describe('Lazy Branches', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should support lazy branches', () => {
    const a = signal(0);
    const b = computed(() => a());
    const c = computed(() => (a() > 0 ? a() : b()));

    expect(c()).toBe(0);
    a(1);
    expect(c()).toBe(1);

    a(0);
    expect(c()).toBe(0);
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should keep graph consistent on errors during activation', () => {
    const a = signal(0);
    const b = computed(() => {
      throw new Error("fail");
    });
    const c = computed(() => a());

    expect(() => b()).toThrow("fail");

    a(1);
    expect(c()).toBe(1);
  });

  it('should keep graph consistent on errors in computeds', () => {
    const a = signal(0);
    const b = computed(() => {
      if (a() === 1) throw new Error("fail");
      return a();
    });
    const c = computed(() => b());

    expect(c()).toBe(0);

    a(1);
    expect(() => b()).toThrow("fail");

    a(2);
    expect(c()).toBe(2);
  });
});

describe('Computed Propagation', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should correctly propagate changes through computed signals', () => {
    const src = signal(0);
    const c1 = computed(() => src() % 2);
    const c2 = computed(() => c1());
    const c3 = computed(() => c2());

    c3();
    src(1); // c1 -> dirty, c2 -> toCheckDirty, c3 -> toCheckDirty
    c2(); // c1 -> none, c2 -> none
    src(3); // c1 -> dirty, c2 -> toCheckDirty

    expect(c3()).toBe(1);
  });

  it('should propagate updated source value through chained computations', () => {
    const src = signal(0);
    const a = computed(() => src());
    const b = computed(() => a() % 2);
    const c = computed(() => src());
    const d = computed(() => b() + c());

    expect(d()).toBe(0);
    src(2);
    expect(d()).toBe(2);
  });

  it('should handle flags are indirectly updated during checkDirty', () => {
    const a = signal(false);
    const b = computed(() => a());
    const c = computed(() => {
      b();
      return 0;
    });
    const d = computed(() => {
      c();
      return b();
    });

    expect(d()).toBe(false);
    a(true);
    expect(d()).toBe(true);
  });
});
