import { describe, it, expect, vi } from 'vitest';
import { 
  reactive, 
  isRef, 
  isReadonly, 
  nextTick,
  effectScope,
  computed as vueComputed 
} from 'vue';
import type { ComponentFactory, Signal, Computed } from '@lattice/core';
import {
  useComponent,
  toRef,
  toWritableRef,
  useComputed,
  useSignalEffect,
} from './vue';

// Define types for our test component
type CounterState = { count: number };

type CounterComponent = {
  count: Signal<number>;
  doubled: Computed<number>;
  increment: () => void;
  decrement: () => void;
  setCount: (value: number) => void;
};

// Test component factory
const Counter: ComponentFactory<CounterState> = ({ store, computed, set }) => ({
  count: store.count,
  doubled: computed(() => store.count() * 2),
  increment: () => set(store.count, (c) => c + 1),
  decrement: () => set(store.count, (c) => c - 1),
  setCount: (value: number) => set(store.count, value),
});

describe('Vue bindings', () => {
  describe('useComponent', () => {
    it('creates a component instance', () => {
      const scope = effectScope();
      const counter = scope.run(() => 
        useComponent<CounterState, CounterComponent>({ count: 0 }, Counter)
      )!;

      expect(counter.count()).toBe(0);
      expect(counter.doubled()).toBe(0);
      
      counter.increment();
      expect(counter.count()).toBe(1);
      expect(counter.doubled()).toBe(2);
      
      scope.stop();
    });

    it('creates isolated instances', () => {
      const scope = effectScope();
      
      const [counter1, counter2] = scope.run(() => [
        useComponent<CounterState, CounterComponent>({ count: 0 }, Counter),
        useComponent<CounterState, CounterComponent>({ count: 10 }, Counter)
      ])!;

      expect(counter1.count()).toBe(0);
      expect(counter2.count()).toBe(10);

      counter1.increment();
      expect(counter1.count()).toBe(1);
      expect(counter2.count()).toBe(10);
      
      scope.stop();
    });
  });

  describe('toRef', () => {
    it('converts a signal to a Vue ref', () => {
      const scope = effectScope();
      
      scope.run(() => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        const countRef = toRef(counter.count);
        
        expect(isRef(countRef)).toBe(true);
        expect(isReadonly(countRef)).toBe(true);
        expect(countRef.value).toBe(0);
      });
      
      scope.stop();
    });

    it('updates when signal changes', async () => {
      const scope = effectScope();
      
      await scope.run(async () => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        const countRef = toRef(counter.count);
        
        expect(countRef.value).toBe(0);
        
        counter.increment();
        await nextTick();
        expect(countRef.value).toBe(1);
        
        counter.setCount(5);
        await nextTick();
        expect(countRef.value).toBe(5);
      });
      
      scope.stop();
    });

    it('works with computed signals', async () => {
      const scope = effectScope();
      
      await scope.run(async () => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 2 }, Counter);
        const doubledRef = toRef(counter.doubled);
        
        expect(doubledRef.value).toBe(4);
        
        counter.increment();
        await nextTick();
        expect(doubledRef.value).toBe(6);
      });
      
      scope.stop();
    });

    it('tracks signal changes through Vue computed', () => {
      const scope = effectScope();
      
      scope.run(() => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        const countRef = toRef(counter.count);
        
        // Verify it's a Vue computed ref
        expect(isRef(countRef)).toBe(true);
        expect(isReadonly(countRef)).toBe(true);
        
        // Initial value
        expect(countRef.value).toBe(0);
        
        // Update and verify reactivity
        counter.increment();
        expect(countRef.value).toBe(1);
      });
      
      scope.stop();
    });
  });

  describe('toWritableRef', () => {
    it('creates a two-way bound ref', async () => {
      const scope = effectScope();
      
      await scope.run(async () => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 0 }, Counter);
        const countRef = toWritableRef(counter.count, counter.setCount);
        
        expect(isRef(countRef)).toBe(true);
        expect(isReadonly(countRef)).toBe(false);
        expect(countRef.value).toBe(0);
        
        // Update via ref
        countRef.value = 5;
        await nextTick();
        expect(counter.count()).toBe(5);
        
        // Update via signal
        counter.increment();
        await nextTick();
        expect(countRef.value).toBe(6);
      });
      
      scope.stop();
    });
  });

  describe('useComputed', () => {
    it('creates a Vue computed for standalone computations', () => {
      const scope = effectScope();
      
      scope.run(() => {
        // useComputed is for creating computed values that don't depend on signals
        // or for creating computeds within the same context
        let value = 3;
        const tripled = useComputed(() => value * 3);
        
        expect(isRef(tripled)).toBe(true);
        expect(isReadonly(tripled)).toBe(true);
        expect(tripled.value).toBe(9);
        
        // Since it's not tracking signals, it won't update automatically
        value = 4;
        expect(tripled.value).toBe(9); // Still 9
      });
      
      scope.stop();
    });

    it('works with component-defined computeds', () => {
      const scope = effectScope();
      
      scope.run(() => {
        type XYState = { x: number; y: number };
        type XYComponent = {
          x: Signal<number>;
          y: Signal<number>;
          sum: Computed<number>;
          setX: (v: number) => void;
          setY: (v: number) => void;
        };
        
        // Define computed in the component factory for proper tracking
        const state = useComponent<XYState, XYComponent>(
          { x: 2, y: 3 },
          ({ store, computed, set }) => ({
            x: store.x,
            y: store.y,
            sum: computed(() => store.x() + store.y()),
            setX: (v: number) => set(store.x, v),
            setY: (v: number) => set(store.y, v),
          })
        );
        
        // Convert to Vue ref
        const sum = toRef(state.sum);
        
        expect(sum.value).toBe(5);
        
        state.setX(5);
        expect(sum.value).toBe(8);
        
        state.setY(10);
        expect(sum.value).toBe(15);
      });
      
      scope.stop();
    });
  });

  describe('useSignalEffect', () => {
    it('runs standalone effects', async () => {
      const scope = effectScope();
      const effectFn = vi.fn();
      
      await scope.run(async () => {
        // useSignalEffect creates its own isolated context
        // It's best used for effects that don't depend on component signals
        let count = 0;
        
        useSignalEffect(() => {
          effectFn(count);
        });
        
        // Initial run
        expect(effectFn).toHaveBeenCalledTimes(1);
        expect(effectFn).toHaveBeenCalledWith(0);
        
        // Since it's not tracking signals, manual updates won't trigger
        count = 1;
        await nextTick();
        expect(effectFn).toHaveBeenCalledTimes(1); // Still 1
      });
      
      scope.stop();
    });

    it('respects immediate option', async () => {
      const scope = effectScope();
      const effectFn = vi.fn();
      
      await scope.run(async () => {
        useSignalEffect(() => {
          effectFn('called');
        }, { immediate: false });
        
        // Should not run immediately
        expect(effectFn).toHaveBeenCalledTimes(0);
        
        // Since it has no signal dependencies, it won't run later either
        await nextTick();
        expect(effectFn).toHaveBeenCalledTimes(0);
      });
      
      scope.stop();
    });
  });

  describe('integration with Vue reactivity', () => {
    it('works with Vue reactive state', async () => {
      const scope = effectScope();
      
      await scope.run(async () => {
        const vueState = reactive({ multiplier: 2 });
        const counter = useComponent<CounterState, CounterComponent>({ count: 5 }, Counter);
        
        // Convert signal to Vue ref first, then use with Vue computed
        const countRef = toRef(counter.count);
        const result = vueComputed(() => 
          countRef.value * vueState.multiplier
        );
        
        expect(result.value).toBe(10);
        
        // Update Lattice signal
        counter.increment();
        expect(result.value).toBe(12);
        
        // Update Vue state
        vueState.multiplier = 3;
        await nextTick();
        expect(result.value).toBe(18);
      });
      
      scope.stop();
    });

    it('can mix with Vue computed', () => {
      const scope = effectScope();
      
      scope.run(() => {
        const counter = useComponent<CounterState, CounterComponent>({ count: 4 }, Counter);
        const countRef = toRef(counter.count);
        
        // Use Vue's computed with Lattice ref
        const quadrupled = vueComputed(() => countRef.value * 4);
        
        expect(quadrupled.value).toBe(16);
        
        counter.increment();
        expect(quadrupled.value).toBe(20);
      });
      
      scope.stop();
    });
  });
});