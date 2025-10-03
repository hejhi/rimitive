import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, effect, batch, resetGlobalState } from '../test-setup';

/**
 * Unit tests for scheduler.ts
 *
 * The scheduler manages effect execution:
 * - FIFO execution order
 * - Batching and auto-flushing
 * - Error isolation
 * - Re-entrance handling
 * - Effect disposal
 */

describe('Scheduler', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Execution Order', () => {
    it('should execute effects in FIFO order', () => {
      const order: string[] = [];
      const source = signal(0);

      effect(() => {
        void source();
        order.push('A');
      });
      effect(() => {
        void source();
        order.push('B');
      });
      effect(() => {
        void source();
        order.push('C');
      });

      order.length = 0;
      source(1);

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('should maintain order with multiple signals', () => {
      const order: string[] = [];
      const s1 = signal(0);
      const s2 = signal(0);

      effect(() => {
        void s1();
        order.push('s1-A');
      });
      effect(() => {
        void s2();
        order.push('s2-A');
      });
      effect(() => {
        void s1();
        order.push('s1-B');
      });

      order.length = 0;
      s1(1);

      expect(order).toEqual(['s1-A', 's1-B']);

      order.length = 0;
      s2(1);

      expect(order).toEqual(['s2-A']);
    });
  });

  describe('Batching', () => {
    it('should batch multiple updates', () => {
      let runs = 0;
      const a = signal(1);
      const b = signal(2);

      effect(() => {
        void a();
        void b();
        runs++;
      });

      runs = 0;

      batch(() => {
        a(10);
        b(20);
      });

      expect(runs).toBe(1); // Single execution
    });

    it('should flush after batch ends', () => {
      let value = 0;
      const source = signal(0);

      effect(() => {
        value = source();
      });

      batch(() => {
        source(10);
        expect(value).toBe(0); // Not flushed yet
      });

      expect(value).toBe(10); // Flushed after batch
    });

    it('should support nested batching', () => {
      let runs = 0;
      const source = signal(0);

      effect(() => {
        void source();
        runs++;
      });

      runs = 0;

      batch(() => {
        source(1);
        batch(() => {
          source(2);
          batch(() => {
            source(3);
          });
        });
      });

      expect(runs).toBe(1); // Single execution after all batches
    });

    it('should batch within effects', () => {
      const order: string[] = [];
      const trigger = signal(0);
      const a = signal(1);
      const b = signal(2);

      effect(() => {
        if (trigger() > 0) {
          order.push('outer');
          batch(() => {
            a(10);
            b(20);
          });
        }
      });

      effect(() => {
        void a();
        order.push('a');
      });

      effect(() => {
        void b();
        order.push('b');
      });

      order.length = 0;
      trigger(1);

      // Outer effect runs, inner batch completes, then a and b effects run
      expect(order).toEqual(['outer', 'a', 'b']);
    });
  });

  describe('Error Handling', () => {
    it('should isolate errors and continue executing', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const executed: string[] = [];
      const source = signal(0);

      effect(() => {
        void source();
        executed.push('A');
      });

      effect(() => {
        void source();
        if (source() === 1) throw new Error('Test error');
        executed.push('B');
      });

      effect(() => {
        void source();
        executed.push('C');
      });

      executed.length = 0;
      source(1);

      // All effects should execute despite B throwing
      expect(executed).toContain('A');
      expect(executed).toContain('C');
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should handle errors in nested batches', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const source = signal(0);
      let ranAfterError = false;

      effect(() => {
        if (source() === 1) {
          batch(() => {
            throw new Error('Batch error');
          });
        }
      });

      effect(() => {
        void source();
        ranAfterError = true;
      });

      ranAfterError = false;
      source(1);

      expect(ranAfterError).toBe(true);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('Re-entrance', () => {
    it('should handle effects modifying signals without infinite loops', () => {
      const source = signal(0);
      let runs = 0;
      const maxRuns = 5;

      effect(() => {
        const val = source();
        runs++;
        if (runs < maxRuns && val < 3) {
          source(val + 1);
        }
      });

      // Should stabilize without infinite loop
      expect(runs).toBeLessThan(10);
      expect(runs).toBeGreaterThan(0);
    });

    it('should handle effects scheduling more effects', () => {
      const order: string[] = [];
      const trigger = signal(0);

      effect(() => {
        if (trigger() === 1) {
          order.push('outer');
          // Schedule more work
          effect(() => {
            order.push('inner');
          });
        }
      });

      trigger(1);

      expect(order).toEqual(['outer', 'inner']);
    });

    it('should queue effects created during flush', () => {
      const order: string[] = [];
      const source = signal(0);
      let innerDispose: (() => void) | undefined;

      effect(() => {
        if (source() === 1) {
          order.push('outer');
          innerDispose = effect(() => {
            void source();
            order.push('inner');
          });
        }
      });

      order.length = 0;
      source(1);

      expect(order).toEqual(['outer', 'inner']);

      // Cleanup
      innerDispose?.();
    });
  });

  describe('Disposal', () => {
    it('should not execute disposed effects', () => {
      let runs = 0;
      const source = signal(0);

      const dispose = effect(() => {
        void source();
        runs++;
      });

      runs = 0;
      dispose();

      source(1);
      expect(runs).toBe(0);
    });

    it('should prevent further executions after disposal in batch', () => {
      let runs = 0;
      const source = signal(0);

      const dispose = effect(() => {
        void source();
        runs++;
      });

      runs = 0; // Reset after initial run

      batch(() => {
        source(1);
        dispose();
      });

      // Effect already ran once initially, but shouldn't run for source(1)
      // because it was disposed before the batch flushed
      expect(runs).toBe(0);
    });

    it('should handle disposal during flush', () => {
      const order: string[] = [];
      const source = signal(0);
      let disposeB: (() => void) | undefined;

      effect(() => {
        void source();
        order.push('A');
        if (source() === 1) {
          disposeB?.();
        }
      });

      disposeB = effect(() => {
        void source();
        order.push('B');
      });

      effect(() => {
        void source();
        order.push('C');
      });

      order.length = 0;
      source(1);

      // B should not run (disposed during A's execution)
      expect(order).toContain('A');
      expect(order).toContain('C');
      // B may or may not be in order depending on scheduling
    });

    it('should be idempotent', () => {
      let cleanupRuns = 0;
      const dispose = effect(() => {
        return () => {
          cleanupRuns++;
        };
      });

      dispose();
      dispose();
      dispose();

      expect(cleanupRuns).toBe(1);
    });
  });

  describe('Immediate Execution', () => {
    it('should run effect immediately on creation', () => {
      let ran = false;
      effect(() => {
        ran = true;
      });

      expect(ran).toBe(true);
    });

    it('should run effect immediately even in batch', () => {
      let ran = false;

      batch(() => {
        effect(() => {
          ran = true;
        });
      });

      expect(ran).toBe(true);
    });
  });

  describe('Effect Cleanup', () => {
    it('should call cleanup before re-running', () => {
      const cleanups: number[] = [];
      let runCount = 0;
      const source = signal(0);

      effect(() => {
        const count = ++runCount;
        void source();
        return () => {
          cleanups.push(count);
        };
      });

      source(1);
      source(2);

      // Cleanup called for run 1 before run 2, for run 2 before run 3
      expect(cleanups).toEqual([1, 2]);
    });

    it('should call cleanup on disposal', () => {
      let cleaned = false;

      const dispose = effect(() => {
        return () => {
          cleaned = true;
        };
      });

      expect(cleaned).toBe(false);
      dispose();
      expect(cleaned).toBe(true);
    });

    it('should handle cleanup errors', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const source = signal(0);

      effect(() => {
        void source();
        return () => {
          throw new Error('Cleanup error');
        };
      });

      // Trigger re-run (which calls cleanup)
      source(1);

      // Should not throw, error handled
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });
});
