import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, computed, resetGlobalState } from '../test-setup';

/**
 * Diamond dependency graph tests
 *
 * Tests diamond-shaped dependency patterns where multiple paths lead to the same node.
 * The key challenge is ensuring each node updates exactly once per change.
 *
 * From alien-signals topology suite.
 */

describe('Diamond Dependencies', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should drop A->B->A updates', () => {
    //     A
    //   / |
    //  B  | <- Looks like a flag doesn't it? :D
    //   \ |
    //     C
    //     |
    //     D
    const a = signal(2);

    const b = computed(() => a() - 1);
    const c = computed(() => a() + b());

    const compute = vi.fn(() => "d: " + c());
    const d = computed(compute);

    // Trigger read
    expect(d()).toBe("d: 3");
    expect(compute).toHaveBeenCalledOnce();
    compute.mockClear();

    a(4);
    d();
    expect(compute).toHaveBeenCalledOnce();
  });

  it('should only update every signal once (diamond graph)', () => {
    // In this scenario "D" should only update once when "A" receives
    // an update. This is sometimes referred to as the "diamond" scenario.
    //     A
    //   /   \
    //  B     C
    //   \   /
    //     D

    const a = signal("a");
    const b = computed(() => a());
    const c = computed(() => a());

    const spy = vi.fn(() => b() + " " + c());
    const d = computed(spy);

    expect(d()).toBe("a a");
    expect(spy).toHaveBeenCalledOnce();

    a("aa");
    expect(d()).toBe("aa aa");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should only update every signal once (diamond graph + tail)', () => {
    // "E" will be likely updated twice if our mark+sweep logic is buggy.
    //     A
    //   /   \
    //  B     C
    //   \   /
    //     D
    //     |
    //     E

    const a = signal("a");
    const b = computed(() => a());
    const c = computed(() => a());

    const d = computed(() => b() + " " + c());

    const spy = vi.fn(() => d());
    const e = computed(spy);

    expect(e()).toBe("a a");
    expect(spy).toHaveBeenCalledOnce();

    a("aa");
    expect(e()).toBe("aa aa");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should bail out if result is the same', () => {
    // Bail out if value of "B" never changes
    // A->B->C
    const a = signal("a");
    const b = computed(() => {
      a();
      return "foo";
    });

    const spy = vi.fn(() => b());
    const c = computed(spy);

    expect(c()).toBe("foo");
    expect(spy).toHaveBeenCalledOnce();

    a("aa");
    expect(c()).toBe("foo");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('Jagged Diamond Dependencies', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should only update every signal once (jagged diamond graph + tails)', () => {
    // "F" and "G" will be likely updated twice if our mark+sweep logic is buggy.
    //     A
    //   /   \
    //  B     C
    //  |     |
    //  |     D
    //   \   /
    //     E
    //   /   \
    //  F     G
    const a = signal("a");

    const b = computed(() => a());
    const c = computed(() => a());

    const d = computed(() => c());

    const eSpy = vi.fn(() => b() + " " + d());
    const e = computed(eSpy);

    const fSpy = vi.fn(() => e());
    const f = computed(fSpy);
    const gSpy = vi.fn(() => e());
    const g = computed(gSpy);

    expect(f()).toBe("a a");
    expect(fSpy).toHaveBeenCalledTimes(1);

    expect(g()).toBe("a a");
    expect(gSpy).toHaveBeenCalledTimes(1);

    eSpy.mockClear();
    fSpy.mockClear();
    gSpy.mockClear();

    a("b");

    expect(e()).toBe("b b");
    expect(eSpy).toHaveBeenCalledTimes(1);

    expect(f()).toBe("b b");
    expect(fSpy).toHaveBeenCalledTimes(1);

    expect(g()).toBe("b b");
    expect(gSpy).toHaveBeenCalledTimes(1);

    eSpy.mockClear();
    fSpy.mockClear();
    gSpy.mockClear();

    a("c");

    expect(e()).toBe("c c");
    expect(eSpy).toHaveBeenCalledTimes(1);

    expect(f()).toBe("c c");
    expect(fSpy).toHaveBeenCalledTimes(1);

    expect(g()).toBe("c c");
    expect(gSpy).toHaveBeenCalledTimes(1);
  });
});
