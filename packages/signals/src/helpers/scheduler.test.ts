import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, effect, resetGlobalState } from '../test-setup';

/**
 * Scheduler tests - FIFO execution and error isolation
 *
 * These tests verify scheduler-specific behavior not covered by higher-level API tests.
 * Other scheduler behavior (batching, cleanup, disposal) is covered in batch.test.ts and effect.test.ts.
 */

describe('Scheduler', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('FIFO Execution Order', () => {
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

  describe('Error Isolation', () => {
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
  });
});
