import { describe, it, expect, beforeEach } from 'vitest';
import {
  signal,
  effect,
  computed,
  batch,
  resetGlobalState,
  getCurrentConsumer,
  setCurrentConsumer,
} from '../test-setup';

/**
 * Effect behavior in complex topologies
 *
 * Tests how effects interact with the reactive graph:
 * - Subscription cleanup when effects stop
 * - Effect interaction with batch operations
 * - Duplicate subscription handling
 * - Indirect flag updates
 *
 * From alien-signals topology suite.
 */

describe('Effect Behaviors', () => {
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
