import { describe, it, expect } from 'vitest';
import { createRoot } from 'solid-js';
import type { Signal, Computed, ComponentContext } from '@lattice/core';
import {
  useComponent,
  createSyncedSignal,
  createLatticeComponent,
  model,
} from './solid';

// Test component factory with proper types
interface CounterState {
  count: number;
}

interface CounterComponent {
  count: Signal<number>;
  doubled: Computed<number>;
  increment: () => void;
  decrement: () => void;
  setCount: (value: number | ((prev: number) => number)) => void;
}

const Counter = ({ store, computed, set }: ComponentContext<CounterState>): CounterComponent => ({
  count: store.count,
  doubled: computed(() => store.count() * 2),
  increment: () => set(store.count, (c) => c + 1),
  decrement: () => set(store.count, (c) => c - 1),
  setCount: (value: number | ((prev: number) => number)) => {
    if (typeof value === 'function') {
      set(store.count, value);
    } else {
      set(store.count, value);
    }
  },
});

describe('Solid bindings', () => {
  describe('useComponent', () => {
    it('creates a component instance', () => {
      createRoot((dispose) => {
        const counter = useComponent({ count: 0 }, Counter);

        // Test initial values
        expect(counter.count()).toBe(0);
        expect(counter.doubled()).toBe(0);

        // Test methods exist
        expect(typeof counter.increment).toBe('function');
        expect(typeof counter.decrement).toBe('function');
        expect(typeof counter.setCount).toBe('function');

        dispose();
      });
    });

    it('creates isolated instances', () => {
      createRoot((dispose) => {
        const counter1 = useComponent({ count: 0 }, Counter);
        const counter2 = useComponent({ count: 10 }, Counter);

        expect(counter1.count()).toBe(0);
        expect(counter2.count()).toBe(10);

        dispose();
      });
    });
  });

  describe('createSyncedSignal', () => {
    it('creates a Solid signal from a Lattice signal', () => {
      createRoot((dispose) => {
        const counter = useComponent({ count: 5 }, Counter);
        const [count] = createSyncedSignal(counter.count);

        // Test initial sync
        expect(count()).toBe(5);

        dispose();
      });
    });

    it('provides setter for two-way binding', () => {
      createRoot((dispose) => {
        const counter = useComponent({ count: 0 }, Counter);
        const [count, setCount] = createSyncedSignal(
          counter.count,
          counter.setCount
        );

        expect(count()).toBe(0);
        expect(typeof setCount).toBe('function');

        dispose();
      });
    });
  });

  describe('createLatticeComponent', () => {
    it('creates components outside Solid components', () => {
      const counter = createLatticeComponent({ count: 5 }, Counter);

      expect(counter.count()).toBe(5);
      expect(counter.doubled()).toBe(10);
      expect(typeof counter.increment).toBe('function');
    });
  });

  describe('model', () => {
    it('creates form binding object', () => {
      createRoot((dispose) => {
        const form = useComponent(
          { email: 'test@example.com' },
          ({ store, set }: ComponentContext<{ email: string }>) => ({
            email: store.email,
            setEmail: (v: string) => set(store.email, v),
          })
        );

        const emailBinding = model(form.email, form.setEmail);

        expect(emailBinding.value).toBe('test@example.com');
        expect(typeof emailBinding.onInput).toBe('function');

        dispose();
      });
    });
  });
});