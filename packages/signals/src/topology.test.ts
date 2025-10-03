import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, effect, computed, batch, resetGlobalState, setCurrentConsumer, getCurrentConsumer } from './test-setup';

/**
 * Comprehensive topology and reactive graph tests
 *
 * Core tests adapted from alien-signals topology suite:
 * https://github.com/alien-signals/alien-signals/blob/main/tests/topology.spec.ts
 *
 * Coverage:
 * - Diamond dependencies and jagged diamond graphs
 * - Bail-out/short-circuit optimization when computed values don't change
 * - Lazy evaluation (push-pull algorithm)
 * - Selective pull-path updates
 * - Dynamic dependency pruning (conditional branches, reordering)
 * - Subscription activation/deactivation
 * - Error handling in complex graphs
 * - Multiple pushes before pull
 *
 * All alien-signals topology tests passing ✅
 * (5 nested effect tests removed - we don't support nested effects)
 */

describe('Topology - Graph Updates', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Diamond Dependencies', () => {
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

  describe('Jagged Diamonds', () => {
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

  describe('Subscription Management', () => {
    it('should only subscribe to signals listened to', () => {
      //    *A
      //   /   \
      // *B     C <- we don't listen to C
      const a = signal("a");

      const b = computed(() => a());
      const spy = vi.fn(() => a());
      computed(spy);

      expect(b()).toBe("a");
      expect(spy).not.toHaveBeenCalled();

      a("aa");
      expect(b()).toBe("aa");
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
      const a = signal("a");
      const spyB = vi.fn(() => a());
      const b = computed(spyB);

      const spyC = vi.fn(() => b());
      const c = computed(spyC);

      const d = computed(() => a());

      let result = "";
      const unsub = effect(() => {
        result = c();
      });

      expect(result).toBe("a");
      expect(d()).toBe("a");

      spyB.mockClear();
      spyC.mockClear();
      unsub();

      a("aa");

      expect(spyB).not.toHaveBeenCalled();
      expect(spyC).not.toHaveBeenCalled();
      expect(d()).toBe("aa");
    });
  });

  describe('Unmarking Logic', () => {
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
      const a = signal("a");
      const b = computed(() => a());
      const c = computed(() => {
        a();
        return "c";
      });
      const spy = vi.fn(() => b() + " " + c());
      const d = computed(spy);

      expect(d()).toBe("a c");
      spy.mockClear();

      a("aa");
      d();
      expect(spy).toHaveReturnedWith("aa c");
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
      const a = signal("a");
      const b = computed(() => a());
      const c = computed(() => {
        a();
        return "c";
      });
      const d = computed(() => {
        a();
        return "d";
      });
      const spy = vi.fn(() => b() + " " + c() + " " + d());
      const e = computed(spy);

      expect(e()).toBe("a c d");
      spy.mockClear();

      a("aa");
      e();
      expect(spy).toHaveReturnedWith("aa c d");
    });

    it('should not update a sub if all deps unmark it', () => {
      // In this scenario "B" and "C" always return the same value. When "A"
      // changes, "D" should not update.
      //     A
      //   /   \
      // *B     *C
      //   \   /
      //     D
      const a = signal("a");
      const b = computed(() => {
        a();
        return "b";
      });
      const c = computed(() => {
        a();
        return "c";
      });
      const spy = vi.fn(() => b() + " " + c());
      const d = computed(spy);

      expect(d()).toBe("b c");
      spy.mockClear();

      a("aa");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Lazy Branches', () => {
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
});

describe('Topology - Effect Behaviors', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Effect Cleanup and Subscriptions', () => {
    it('should clear subscriptions when untracked by all subscribers', () => {
      let bRunTimes = 0;

      const a = signal(1);
      const b = computed(() => {
        bRunTimes++;
        return a() * 2;
      });
      const stopEffect = effect(() => {
        b();
      });

      expect(bRunTimes).toBe(1);
      a(2);
      expect(bRunTimes).toBe(2);
      stopEffect();
      a(3);
      expect(bRunTimes).toBe(2);
    });
  });


  describe('Batch and Custom Effects', () => {
    it('should custom effect support batch', () => {
      function batchEffect(fn: () => void) {
        return effect(() => {
          return batch(() => fn());
        });
      }

      const logs: string[] = [];
      const a = signal(0);
      const b = signal(0);

      const aa = computed(() => {
        logs.push('aa-0');
        if (!a()) {
          b(1);
        }
        logs.push('aa-1');
      });

      const bb = computed(() => {
        logs.push('bb');
        return b();
      });

      batchEffect(() => {
        bb();
      });
      batchEffect(() => {
        aa();
      });

      expect(logs).toEqual(['bb', 'aa-0', 'aa-1', 'bb']);
    });
  });

  describe('Duplicate Subscribers', () => {
    it('should duplicate subscribers do not affect the notify order', () => {
      const src1 = signal(0);
      const src2 = signal(0);
      const order: string[] = [];

      effect(() => {
        order.push('a');
        const currentConsumer = getCurrentConsumer();
        setCurrentConsumer(null);
        const isOne = src2() === 1;
        setCurrentConsumer(currentConsumer);
        if (isOne) {
          src1();
        }
        src2();
        src1();
      });
      effect(() => {
        order.push('b');
        src1();
      });
      src2(1); // src1.subs: a -> b -> a

      order.length = 0;
      src1(src1() + 1);

      expect(order).toEqual(['a', 'b']);
    });
  });

  describe('Indirect Flag Updates', () => {
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

      let triggers = 0;

      effect(() => {
        d();
        triggers++;
      });
      expect(triggers).toBe(1);
      a(true);
      expect(triggers).toBe(2);
    });
  });
});

describe('Topology - Lazy Evaluation', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should not compute until accessed (lazy evaluation)', () => {
    let count1 = 0;
    let count2 = 0;

    const source = signal(1);
    const level1 = computed(() => {
      count1++;
      return source() * 2;
    });
    const level2 = computed(() => {
      count2++;
      return level1() * 2;
    });

    // Read initial value
    expect(level2()).toBe(4);
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    count1 = count2 = 0;

    // Update source - nothing computes yet
    source(10);
    expect(count1).toBe(0);
    expect(count2).toBe(0);

    // Access triggers lazy computation
    expect(level2()).toBe(40);
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it('should skip unaccessed branches', () => {
    let countA = 0;
    let countB = 0;

    const source = signal(1);
    const branchA = computed(() => {
      countA++;
      return source() * 2;
    });
    const branchB = computed(() => {
      countB++;
      return source() * 3;
    });

    expect(branchA()).toBe(2);
    expect(branchB()).toBe(3);

    countA = countB = 0;
    source(10);

    // Only access B
    expect(branchB()).toBe(30);

    expect(countA).toBe(0); // Not accessed
    expect(countB).toBe(1); // Accessed
  });

  it('should only update nodes in pull path', () => {
    const s = signal(1);

    let countA = 0;
    const a = computed(() => {
      countA++;
      return s() * 2;
    });

    let countB = 0;
    const b = computed(() => {
      countB++;
      return a() * 2;
    });

    let countC = 0;
    const c = computed(() => {
      countC++;
      return a() * 3; // Also depends on A
    });

    // Initial
    expect(b()).toBe(4);
    expect(c()).toBe(6);
    expect(countA).toBe(1);
    expect(countB).toBe(1);
    expect(countC).toBe(1);

    // Change signal
    s(2);

    // Read only B - should update A and B, but NOT C
    expect(b()).toBe(8);
    expect(countA).toBe(2);
    expect(countB).toBe(2);
    expect(countC).toBe(1); // C not in pull path

    // Now read C - A is already updated, so only C computes
    expect(c()).toBe(12);
    expect(countA).toBe(2); // A already updated
    expect(countC).toBe(2); // C updates now
  });

  it('should handle multiple pushes before pull', () => {
    const source = signal(1);
    const derived = computed(() => source() * 2);

    expect(derived()).toBe(2);

    // Multiple updates
    source(2);
    source(3);
    source(4);
    source(5);

    // Computes with latest value only
    expect(derived()).toBe(10);
  });
});

describe('Topology - Short-Circuit Optimization', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('must recompute to detect value changes', () => {
    const s = signal(2);

    let countA = 0;
    const a = computed(() => {
      countA++;
      return Math.abs(s()); // abs(2) = 2, abs(-2) = 2
    });

    let countB = 0;
    const b = computed(() => {
      countB++;
      return a() * 3;
    });

    // Initial
    expect(b()).toBe(6);
    expect(countA).toBe(1);
    expect(countB).toBe(1);

    // Change signal - A's output stays same
    s(-2);

    // Read b - A MUST recompute to know its value didn't change
    expect(b()).toBe(6);
    expect(countA).toBe(2); // A recomputed
    expect(countB).toBe(1); // B skipped (A's value didn't change)
  });
});

describe('Topology - Dynamic Dependencies', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should prune dependencies when branches change', () => {
    const condition = signal(true);
    const a = signal(1);
    const b = signal(1);

    let bComputations = 0;
    const expensiveB = computed(() => {
      bComputations++;
      return b() * 2;
    });

    let resultComputations = 0;
    const result = computed(() => {
      resultComputations++;
      return condition() ? a() : expensiveB();
    });

    // Initial: uses a
    expect(result()).toBe(1);
    expect(bComputations).toBe(0);
    expect(resultComputations).toBe(1);

    // Switch to b
    condition(false);
    expect(result()).toBe(2);
    expect(bComputations).toBe(1);

    // Switch back to a
    condition(true);
    expect(result()).toBe(1);
    expect(resultComputations).toBe(3);

    // Update b multiple times - should NOT recompute
    bComputations = 0;
    resultComputations = 0;
    for (let i = 0; i < 10; i++) {
      b(i);
      void result();
    }
    expect(bComputations).toBe(0); // Not accessed
    expect(resultComputations).toBe(0); // Not recomputed
  });

  it('should handle conditional dependencies correctly', () => {
    const show = signal(true);
    const name = signal('Alice');
    const details = signal('Engineer');

    let computeCount = 0;
    const display = computed(() => {
      computeCount++;
      return show() ? `${name()}: ${details()}` : name();
    });

    // Initial: depends on all three
    expect(display()).toBe('Alice: Engineer');
    expect(computeCount).toBe(1);

    // Hide details - prunes details dependency
    show(false);
    expect(display()).toBe('Alice');
    expect(computeCount).toBe(2);

    // Update details - should NOT trigger
    details('Senior Engineer');
    expect(display()).toBe('Alice');
    expect(computeCount).toBe(2);

    // Show details again - re-establishes dependency
    show(true);
    expect(display()).toBe('Alice: Senior Engineer');
    expect(computeCount).toBe(3);

    // Now details should trigger
    details('Principal');
    expect(display()).toBe('Alice: Principal');
    expect(computeCount).toBe(4);
  });

  it('should handle dependency reordering', () => {
    const a = signal('A');
    const b = signal('B');
    const c = signal('C');

    let order = 'ABC';
    const dynamic = computed(() => {
      if (order === 'ABC') return a() + b() + c();
      if (order === 'CBA') return c() + b() + a();
      return b() + a() + c();
    });

    expect(dynamic()).toBe('ABC');

    order = 'CBA';
    a('A2');
    expect(dynamic()).toBe('CBA2');

    order = 'BAC';
    b('B2');
    expect(dynamic()).toBe('B2A2C');

    // All signals should still work
    a('A3');
    expect(dynamic()).toBe('B2A3C');
    c('C2');
    expect(dynamic()).toBe('B2A3C2');
  });

  it('should prune middle dependencies', () => {
    const signals = [signal(0), signal(1), signal(2), signal(3), signal(4)];
    let mask = 0b11111; // All enabled

    const sum = computed(() => {
      let total = 0;
      for (let i = 0; i < signals.length; i++) {
        if (mask & (1 << i)) total += signals[i]!();
      }
      return total;
    });

    expect(sum()).toBe(10); // 0+1+2+3+4

    // Keep only first and last
    mask = 0b10001;
    signals[0]!(10);
    expect(sum()).toBe(14); // 10+4

    // Middle signals should not trigger
    signals[1]!(100);
    signals[2]!(100);
    signals[3]!(100);
    expect(sum()).toBe(14); // Unchanged
  });

  it('should handle many dependency changes efficiently', () => {
    const signals = Array.from({ length: 10 }, (_, i) => signal(i));

    let pattern = 'all';
    const sum = computed(() => {
      let total = 0;
      if (pattern === 'all') {
        for (let i = 0; i < 10; i++) total += signals[i]!();
      } else {
        for (let i = 0; i < 10; i += 2) total += signals[i]!(); // Even only
      }
      return total;
    });

    expect(sum()).toBe(45); // 0+1+2+3+4+5+6+7+8+9

    // Switch to even-only
    pattern = 'even';
    signals[0]!(10);
    expect(sum()).toBe(30); // 10+2+4+6+8

    // Odd signals should not trigger in 'even' mode
    signals[1]!(100);
    signals[3]!(100);
    expect(sum()).toBe(30); // Unchanged
  });
});

describe('Topology - Computed Propagation', () => {
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
