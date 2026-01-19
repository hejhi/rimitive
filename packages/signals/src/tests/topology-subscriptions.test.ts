import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, effect, computed, resetGlobalState } from '../test-setup';

/**
 * Subscription management and unmarking logic tests
 *
 * Tests how the reactive graph manages subscriptions:
 * - Only active computeds receive updates
 * - Subscriptions are cleaned up when no longer needed
 * - Unmarking logic ensures correct propagation even when some deps short-circuit
 *
 * From alien-signals topology suite.
 */

describe('Subscription Management', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should only subscribe to signals listened to', () => {
    //    *A
    //   /   \
    // *B     C <- we don't listen to C
    const a = signal('a');

    const b = computed(() => a());
    const spy = vi.fn(() => a());
    computed(spy);

    expect(b()).toBe('a');
    expect(spy).not.toHaveBeenCalled();

    a('aa');
    expect(b()).toBe('aa');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should only subscribe to signals listened to II', () => {
    // Here both "B" and "C" are active in the beginning, but
    // "B" becomes inactive later. At that point it should
    // not receive any updates anymore.
    //    *A
    //   /   \
    // *B     D <- we don't listen to C
    //  |
    // *C
    const a = signal('a');
    const spyB = vi.fn(() => a());
    const b = computed(spyB);

    const spyC = vi.fn(() => b());
    const c = computed(spyC);

    const d = computed(() => a());

    let result = '';
    const unsub = effect(() => {
      result = c();
    });

    expect(result).toBe('a');
    expect(d()).toBe('a');

    spyB.mockClear();
    spyC.mockClear();
    unsub();

    a('aa');

    expect(spyB).not.toHaveBeenCalled();
    expect(spyC).not.toHaveBeenCalled();
    expect(d()).toBe('aa');
  });
});

describe('Unmarking Logic', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should ensure subs update even if one dep unmarks it', () => {
    // In this scenario "C" always returns the same value. When "A"
    // changes, "B" will update, then "C" at which point its update
    // to "D" will be unmarked. But "D" must still update because
    // "B" marked it. If "D" isn't updated, then we have a bug.
    //     A
    //   /   \
    //  B     *C <- returns same value every time
    //   \   /
    //     D
    const a = signal('a');
    const b = computed(() => a());
    const c = computed(() => {
      a();
      return 'c';
    });
    const spy = vi.fn(() => b() + ' ' + c());
    const d = computed(spy);

    expect(d()).toBe('a c');
    spy.mockClear();

    a('aa');
    d();
    expect(spy).toHaveReturnedWith('aa c');
  });

  it('should ensure subs update even if two deps unmark it', () => {
    // In this scenario both "C" and "D" always return the same
    // value. But "E" must still update because "A" marked it.
    // If "E" isn't updated, then we have a bug.
    //     A
    //   / | \
    //  B *C *D
    //   \ | /
    //     E
    const a = signal('a');
    const b = computed(() => a());
    const c = computed(() => {
      a();
      return 'c';
    });
    const d = computed(() => {
      a();
      return 'd';
    });
    const spy = vi.fn(() => b() + ' ' + c() + ' ' + d());
    const e = computed(spy);

    expect(e()).toBe('a c d');
    spy.mockClear();

    a('aa');
    e();
    expect(spy).toHaveReturnedWith('aa c d');
  });

  it('should not update a sub if all deps unmark it', () => {
    // In this scenario "B" and "C" always return the same value. When "A"
    // changes, "D" should not update.
    //     A
    //   /   \
    // *B     *C
    //   \   /
    //     D
    const a = signal('a');
    const b = computed(() => {
      a();
      return 'b';
    });
    const c = computed(() => {
      a();
      return 'c';
    });
    const spy = vi.fn(() => b() + ' ' + c());
    const d = computed(spy);

    expect(d()).toBe('b c');
    spy.mockClear();

    a('aa');
    expect(spy).not.toHaveBeenCalled();
  });
});
