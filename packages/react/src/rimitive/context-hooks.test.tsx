import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRimitiveContext } from './context-hooks';
import { compose, defineModule } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  SubscribeModule,
} from '@rimitive/signals/extend';

// Create a complete signals module using compose
const SignalsModule = defineModule({
  name: 'signals' as const,
  create: () => {
    const use = compose(
      SignalModule,
      ComputedModule,
      EffectModule,
      BatchModule,
      SubscribeModule
    );
    return {
      signal: use.signal,
      computed: use.computed,
      effect: use.effect,
      batch: use.batch,
      subscribe: use.subscribe,
    };
  },
});

describe('Rimitive Context Hooks', () => {
  describe('useRimitiveContext', () => {
    it('should create and manage context lifecycle', () => {
      const { result, unmount } = renderHook(() =>
        useRimitiveContext(SignalsModule)
      );

      // Context should have the signals module
      expect(typeof result.current.signals.signal).toBe('function');
      expect(typeof result.current.signals.computed).toBe('function');
      expect(typeof result.current.signals.effect).toBe('function');
      expect(typeof result.current.signals.batch).toBe('function');
      expect(typeof result.current.dispose).toBe('function');

      // Create a signal to verify it works
      const count = result.current.signals.signal(0);
      expect(count()).toBe(0);

      // Spy on dispose to verify cleanup
      const disposeSpy = vi.fn();
      const originalDispose = result.current.dispose.bind(result.current);
      result.current.dispose = () => {
        disposeSpy();
        originalDispose();
      };

      unmount();

      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should only create context once per component instance', () => {
      const { result, rerender } = renderHook(() =>
        useRimitiveContext(SignalsModule)
      );

      const firstContext = result.current;

      // Multiple rerenders should not create new contexts
      rerender();
      rerender();

      expect(result.current).toBe(firstContext);
    });

    it('should allow signal creation and updates', () => {
      const { result } = renderHook(() => useRimitiveContext(SignalsModule));

      const count = result.current.signals.signal(0);
      const doubled = result.current.signals.computed(() => count() * 2);

      expect(count()).toBe(0);
      expect(doubled()).toBe(0);

      act(() => {
        count(10);
      });

      expect(count()).toBe(10);
      expect(doubled()).toBe(20);
    });

    it('should support batch updates', () => {
      const { result } = renderHook(() => useRimitiveContext(SignalsModule));

      const { signal, computed, effect, batch } = result.current.signals;

      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());

      let computeCount = 0;
      effect(() => {
        void sum(); // Track the sum
        computeCount++;
      });

      expect(computeCount).toBe(1);

      act(() => {
        batch(() => {
          a(10);
          b(20);
        });
      });

      // Should only compute once due to batching
      expect(computeCount).toBe(2);
      expect(sum()).toBe(30);
    });

    it('should work with custom modules', () => {
      // Create a custom module
      const CounterModule = defineModule({
        name: 'counter' as const,
        create: () => {
          let count = 0;
          return {
            increment: () => ++count,
            decrement: () => --count,
            get: () => count,
          };
        },
      });

      const { result } = renderHook(() => useRimitiveContext(CounterModule));

      // Should have the custom module impl
      expect(typeof result.current.counter).toBe('object');
      expect(typeof result.current.counter.increment).toBe('function');
      expect(typeof result.current.dispose).toBe('function');

      // Test custom functionality
      expect(result.current.counter.get()).toBe(0);
      act(() => {
        result.current.counter.increment();
        result.current.counter.increment();
      });
      expect(result.current.counter.get()).toBe(2);
    });
  });
});
