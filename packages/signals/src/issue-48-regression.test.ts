import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, effect, resetGlobalState, setCurrentConsumer, getCurrentConsumer } from './test-setup';

/**
 * Regression test adapted from alien-signals issue #48
 * https://github.com/alien-signals/alien-signals/issues/48
 *
 * Tests a complex scenario involving:
 * - Nested reactions created dynamically
 * - Disposal of inner reactions
 * - Multiple signal updates triggering different reaction paths
 *
 * This tests that disposal and re-creation of effects works correctly
 * without causing memory leaks or incorrect subscriptions.
 */

describe('Issue #48 Regression - Nested Reaction Disposal', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  // Helper function to create a "reaction" (similar to MobX/Vue's reactivity pattern)
  // This watches a data function and calls an effect function when the data changes
  interface ReactionOptions<T = unknown, F extends boolean = boolean> {
    fireImmediately?: F;
    equals?: F extends true
      ? (a: T, b: T | undefined) => boolean
      : (a: T, b: T) => boolean;
    onError?: (error: unknown) => void;
    scheduler?: (fn: () => void) => void;
    once?: boolean;
  }

  function reaction<T>(
    dataFn: () => T,
    effectFn: (newValue: T, oldValue: T | undefined) => void,
    options: ReactionOptions<T> = {}
  ): () => void {
    const {
      scheduler = (fn) => fn(),
      equals = Object.is,
      onError,
      once = false,
      fireImmediately = false,
    } = options;

    let prevValue: T | undefined;
    let version = 0;

    // Helper to run code without tracking dependencies
    function untrack<R>(callback: () => R): R {
      const currentConsumer = getCurrentConsumer();
      setCurrentConsumer(null);
      try {
        return callback();
      } finally {
        setCurrentConsumer(currentConsumer);
      }
    }

    const tracked = computed(() => {
      try {
        return dataFn();
      } catch (error) {
        untrack(() => onError?.(error));
        return prevValue!;
      }
    });

    const dispose = effect(() => {
      const current = tracked();
      if (!fireImmediately && !version) {
        prevValue = current;
      }
      version++;
      if (equals(current, prevValue!)) return;
      const oldValue = prevValue;
      prevValue = current;
      untrack(() =>
        scheduler(() => {
          try {
            effectFn(current, oldValue);
          } catch (error) {
            onError?.(error);
          } finally {
            if (once) {
              if (fireImmediately && version > 1) dispose();
              else if (!fireImmediately && version > 0) dispose();
            }
          }
        })
      );
    });

    return dispose;
  }

  it('should handle issue #48 scenario - nested reaction disposal', () => {
    const source = signal(0);
    let disposeInner: (() => void) | undefined;

    // Outer reaction watches source and creates/destroys inner reaction
    reaction(
      () => source(),
      (val) => {
        if (val === 1) {
          // Create inner reaction when source becomes 1
          disposeInner = reaction(
            () => source(),
            () => {
              // Inner reaction effect - empty but subscribes to source
            }
          );
        } else if (val === 2) {
          // Dispose inner reaction when source becomes 2
          disposeInner!();
        }
      }
    );

    // This sequence should not cause any errors or memory issues
    source(1); // Creates inner reaction
    source(2); // Disposes inner reaction
    source(3); // Continues after disposal

    // Test passes if no errors are thrown
    expect(source()).toBe(3);
  });

  it('should handle multiple cycles of creation and disposal', () => {
    const source = signal(0);
    const disposals: Array<() => void> = [];

    reaction(
      () => source(),
      (val) => {
        if (val % 2 === 1) {
          // Odd numbers: create reactions
          const dispose = reaction(
            () => source(),
            () => {
              // Inner reaction
            }
          );
          disposals.push(dispose);
        } else if (val % 2 === 0 && val > 0) {
          // Even numbers: dispose previous reaction
          const dispose = disposals.pop();
          dispose?.();
        }
      }
    );

    source(1); // Create
    source(2); // Dispose
    source(3); // Create
    source(4); // Dispose
    source(5); // Create
    source(6); // Dispose

    expect(source()).toBe(6);
    expect(disposals.length).toBe(0); // All should be disposed
  });

  it('should handle immediate disposal in reaction', () => {
    const source = signal(0);
    let innerDisposed = false;

    reaction(
      () => source(),
      (val) => {
        if (val === 1) {
          const dispose = reaction(
            () => source(),
            () => {
              // Inner effect
            }
          );
          // Dispose immediately after creation
          dispose();
          innerDisposed = true;
        }
      }
    );

    source(1);
    expect(innerDisposed).toBe(true);

    // Should not cause issues on subsequent updates
    source(2);
    source(3);
    expect(source()).toBe(3);
  });

  it('should handle disposal during effect execution', () => {
    const trigger = signal(0);
    let disposeInner: (() => void) | undefined;
    let innerRuns = 0;

    const disposeOuter = reaction(
      () => trigger(),
      (val) => {
        if (val === 1) {
          disposeInner = reaction(
            () => trigger(),
            () => {
              innerRuns++;
            }
          );
        } else if (val === 2 && disposeInner) {
          disposeInner();
          disposeInner = undefined;
        }
      }
    );

    trigger(1); // Create inner reaction
    expect(innerRuns).toBe(0); // Doesn't fire immediately by default

    trigger(2); // This triggers outer reaction which disposes inner
    // The inner reaction hasn't run yet because it doesn't fire immediately
    expect(innerRuns).toBe(0); // Inner never ran before disposal

    trigger(3); // After disposal
    expect(innerRuns).toBe(0); // Inner should still not have run

    // Cleanup
    disposeOuter();
  });

  it('should maintain correct subscription counts', () => {
    const source = signal(0);
    const createdReactions: Array<() => void> = [];

    const disposeOuter = reaction(
      () => source(),
      (val) => {
        // Create up to 3 nested reactions
        if (val > 0 && val <= 3) {
          const dispose = reaction(
            () => source(),
            () => {
              // Each nested reaction subscribes to source
            }
          );
          createdReactions.push(dispose);
        }
      }
    );

    // Create 3 nested reactions
    source(1);
    source(2);
    source(3);
    expect(createdReactions.length).toBe(3);

    // All should be able to update without errors
    source(4);
    source(5);

    // Dispose all
    createdReactions.forEach(d => d());
    disposeOuter();

    // Final update after all disposed
    source(6);
    expect(source()).toBe(6);
  });
});
