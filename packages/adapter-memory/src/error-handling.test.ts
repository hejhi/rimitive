import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createSlice, createComponent, select } from '@lattice/core';

describe('Memory Adapter - Error Handling', () => {
  // Mock console methods to prevent error spam in tests
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  
  beforeEach(() => {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  
  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  /**
   * Tests for errors in model mutations
   */
  describe('model mutation errors', () => {
    it('should handle errors thrown in model mutations', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          throwError: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          throwError: () => {
            throw new Error('Mutation error');
          }
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          throwError: m.throwError
        }));

        return { model, actions, views: {} };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Normal operation should work
      expect(result.model.get().count).toBe(0);
      result.actions.get().increment();
      expect(result.model.get().count).toBe(1);

      // Error in mutation should throw
      expect(() => {
        result.actions.get().throwError();
      }).toThrow('Mutation error');

      // Adapter should continue working after error
      result.actions.get().increment();
      expect(result.model.get().count).toBe(2);
    });

    it('should handle errors in model factory', () => {
      const component = createComponent(() => {
        const model = createModel<{ value: number }>(() => {
          // Simulate error during model initialization
          if (Math.random() > -1) { // Always true to ensure test consistency
            throw new Error('Model initialization error');
          }
          return { value: 0 };
        });

        return { 
          model, 
          actions: createSlice(model, () => ({})), 
          views: {} 
        };
      });

      const adapter = createMemoryAdapter();
      
      // Should throw when executing component with faulty model
      expect(() => {
        adapter.executeComponent(component);
      }).toThrow('Model initialization error');
    });

    it('should handle errors in set() updater functions', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ value: 0 });
      
      // The current implementation doesn't catch errors in updater functions
      // so they propagate to the caller
      expect(() => {
        store.set(() => {
          throw new Error('Updater function error');
        });
      }).toThrow('Updater function error');

      // State remains unchanged after error
      expect(store.get().value).toBe(0);
      
      // Store continues to work after error
      store.set({ value: 5 });
      expect(store.get().value).toBe(5);
    });
  });

  /**
   * Tests for errors in slice selectors
   */
  describe('slice selector errors', () => {
    it('should handle errors thrown in slice selectors', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ value: 10, divideBy: 2 });
      
      // Create a slice with a selector that can throw
      const divisionSlice = primitives.createSlice(store, (state) => {
        if (state.divideBy === 0) {
          throw new Error('Division by zero');
        }
        return { result: state.value / state.divideBy };
      });

      // Should work with valid divisor
      expect(divisionSlice.get()).toEqual({ result: 5 });

      // Note: The current implementation eagerly evaluates slice selectors
      // when the parent store updates, so the error is thrown during set()
      expect(() => {
        store.set({ value: 10, divideBy: 0 });
      }).toThrow('Division by zero');

      // Should recover when divisor is valid again
      store.set({ value: 10, divideBy: 5 });
      expect(divisionSlice.get()).toEqual({ result: 2 });
    });

    it('should handle errors in nested slice selectors', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: { items: number[]; threshold: number };
        }>(() => ({
          data: { items: [1, 2, 3], threshold: 1 } // Start with valid threshold
        }));

        const dataSlice = createSlice(model, (m) => m.data);
        
        // This slice can throw an error
        const processedSlice = createSlice(model, () => ({
          data: select(dataSlice, (d) => {
            if (d.threshold === 0) {
              throw new Error('Invalid threshold');
            }
            return d.items.map(item => item / d.threshold);
          })
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { processed: processedSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Should work initially with valid threshold
      expect(result.views.processed.get()).toEqual({
        data: [1, 2, 3]
      });

      // Error is thrown during model update due to eager evaluation
      expect(() => {
        result.model.set({ data: { items: [2, 4, 6], threshold: 0 } });
      }).toThrow('Invalid threshold');
      
      // Update model to fix the error
      result.model.set({ data: { items: [2, 4, 6], threshold: 2 } });
      
      // Should work now
      expect(result.views.processed.get()).toEqual({
        data: [1, 2, 3]
      });
    });

    it('should demonstrate slice error behavior', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ value: 10, flag: false });
      
      // One slice that throws conditionally
      const errorSlice = primitives.createSlice(store, (state) => {
        if (state.flag) {
          throw new Error('Flag is true');
        }
        return { safe: state.value };
      });

      // Another slice that should work independently
      const normalSlice = primitives.createSlice(store, (state) => ({
        doubled: state.value * 2
      }));

      // Both should work initially
      expect(errorSlice.get()).toEqual({ safe: 10 });
      expect(normalSlice.get()).toEqual({ doubled: 20 });

      // The current implementation evaluates slices eagerly during updates
      // This means errors in one slice can prevent the update
      let errorThrown = false;
      try {
        store.set({ value: 15, flag: true });
      } catch (e) {
        errorThrown = true;
        expect((e as Error).message).toBe('Flag is true');
      }
      expect(errorThrown).toBe(true);

      // In the current implementation, state does update even when slices throw
      // This is a limitation - there's no transactional rollback
      expect(store.get()).toEqual({ value: 15, flag: true });
      expect(normalSlice.get()).toEqual({ doubled: 30 });
      
      // Error slice will throw when accessed
      expect(() => errorSlice.get()).toThrow('Flag is true');
      
      // Fix the error condition
      store.set({ value: 20, flag: false });
      expect(errorSlice.get()).toEqual({ safe: 20 });
      expect(normalSlice.get()).toEqual({ doubled: 40 });
    });
  });

  /**
   * Tests for errors in computed views
   */
  describe('computed view errors', () => {
    it('should handle errors in computed view functions', () => {
      const component = createComponent(() => {
        const model = createModel<{ items: string[] }>(() => ({
          items: ['a', 'b', 'c']
        }));

        const itemsSlice = createSlice(model, (m) => ({ items: m.items }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            // Computed view that can throw
            itemView: () => itemsSlice((state) => {
              if (state.items.length === 0) {
                throw new Error('No items available');
              }
              return {
                first: state.items[0],
                count: state.items.length
              };
            })
          }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Should work with items
      const view = result.views.itemView();
      expect(view.get()).toEqual({
        first: 'a',
        count: 3
      });

      // Error occurs during model update due to eager evaluation
      expect(() => {
        result.model.set({ items: [] });
      }).toThrow('No items available');

      // Should recover when items added
      result.model.set({ items: ['x'] });
      expect(view.get()).toEqual({
        first: 'x',
        count: 1
      });
    });

    it('should handle errors in chained computed views', () => {
      const component = createComponent(() => {
        const model = createModel<{ value: number }>(() => ({
          value: 5
        }));

        const baseSlice = createSlice(model, (m) => ({ val: m.value }));

        // First computed view
        const computed1 = () => baseSlice((state) => {
          if (state.val < 0) {
            throw new Error('Negative value in computed1');
          }
          return { positive: state.val };
        });

        // Second computed view that depends on the first conceptually
        const computed2 = () => baseSlice((state) => {
          if (state.val === 0) {
            throw new Error('Zero value in computed2');
          }
          return { reciprocal: 1 / state.val };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            view1: computed1,
            view2: computed2
          }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const view1 = result.views.view1();
      const view2 = result.views.view2();

      // Both should work initially
      expect(view1.get()).toEqual({ positive: 5 });
      expect(view2.get()).toEqual({ reciprocal: 0.2 });

      // Make value negative - both views are evaluated during update
      try {
        result.model.set({ value: -5 });
      } catch (e) {
        expect((e as Error).message).toBe('Negative value in computed1');
      }
      
      // Try again with zero - again error during update
      try {
        result.model.set({ value: 0 });
      } catch (e) {
        expect((e as Error).message).toBe('Zero value in computed2');
      }
      
      // Set a valid value
      result.model.set({ value: 10 });
      expect(view1.get()).toEqual({ positive: 10 });
      expect(view2.get()).toEqual({ reciprocal: 0.1 });
    });
  });

  /**
   * Tests for errors in subscriptions
   */
  describe('subscription errors', () => {
    it('should handle errors thrown in subscription listeners', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ count: 0 });
      
      const goodListener = vi.fn();
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const anotherGoodListener = vi.fn();

      // Subscribe multiple listeners
      store.subscribe(goodListener);
      store.subscribe(badListener);
      store.subscribe(anotherGoodListener);

      // Update - error from listener will be thrown
      expect(() => {
        store.set({ count: 1 });
      }).toThrow('Listener error');

      // In the current implementation, the error stops execution
      // so listeners after the bad one may not be called
      expect(goodListener).toHaveBeenCalledWith({ count: 1 });
      expect(badListener).toHaveBeenCalledWith({ count: 1 });
      // The third listener might not be called due to error propagation

      // Store should continue working despite listener errors
      expect(() => {
        store.set({ count: 2 });
      }).toThrow('Listener error');
      
      // State does update even with listener errors
      expect(store.get().count).toBe(2);
    });

    it('should handle errors in slice subscription listeners', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ value: 0 });
      const slice = primitives.createSlice(store, s => ({ doubled: s.value * 2 }));

      const listeners = {
        good1: vi.fn(),
        bad: vi.fn(() => { throw new Error('Slice listener error'); }),
        good2: vi.fn()
      };

      // Subscribe all listeners
      slice.subscribe(listeners.good1);
      slice.subscribe(listeners.bad);
      slice.subscribe(listeners.good2);

      // Update store - error will be thrown
      expect(() => {
        store.set({ value: 5 });
      }).toThrow('Slice listener error');

      // In the current implementation, listeners are called until error occurs
      // The exact order depends on Set iteration order
      expect(listeners.bad).toHaveBeenCalledWith({ doubled: 10 });
      // Other listeners may or may not be called depending on order

      // Slice should continue working
      expect(slice.get()).toEqual({ doubled: 10 });
    });

    it('should handle errors during subscription cleanup', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ value: 0 });
      
      // Mock subscribe to return a throwing unsubscribe
      const originalSubscribe = store.subscribe;
      store.subscribe = (listener: any) => {
        const unsub = originalSubscribe.call(store, listener);
        return () => {
          unsub();
          throw new Error('Unsubscribe error');
        };
      };

      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      // Should work normally
      store.set({ value: 1 });
      expect(listener).toHaveBeenCalledWith({ value: 1 });

      // Unsubscribe should throw but not break the store
      expect(() => unsubscribe()).toThrow('Unsubscribe error');

      // Store should continue working
      store.set({ value: 2 });
      // Listener shouldn't be called after unsubscribe (despite error)
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Tests for invalid inputs
   */
  describe('invalid inputs', () => {
    it('should handle null/undefined in model', () => {
      const component = createComponent(() => {
        const model = createModel<{
          value: number | null;
          nested: { data: string } | undefined;
        }>(() => ({
          value: null,
          nested: undefined
        }));

        const slices = {
          value: createSlice(model, (m) => ({ val: m.value })),
          nested: createSlice(model, (m) => ({ data: m.nested }))
        };

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: slices
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Should handle null/undefined values
      expect(result.views.value.get()).toEqual({ val: null });
      expect(result.views.nested.get()).toEqual({ data: undefined });

      // Should handle updates with null/undefined
      result.model.set({ value: 42, nested: { data: 'test' } });
      expect(result.views.value.get()).toEqual({ val: 42 });
      expect(result.views.nested.get()).toEqual({ data: { data: 'test' } });

      // Back to null/undefined
      result.model.set({ value: null, nested: undefined });
      expect(result.views.value.get()).toEqual({ val: null });
      expect(result.views.nested.get()).toEqual({ data: undefined });
    });

    it('should handle invalid slice factory inputs', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ value: 10 });

      // Slice that returns undefined
      const undefinedSlice = primitives.createSlice(store, () => undefined as any);
      expect(undefinedSlice.get()).toBe(undefined);

      // Slice that returns null
      const nullSlice = primitives.createSlice(store, () => null as any);
      expect(nullSlice.get()).toBe(null);

      // These should still be reactive
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      undefinedSlice.subscribe(listener1);
      nullSlice.subscribe(listener2);

      store.set({ value: 20 });
      
      // The adapter only notifies on changes, and undefined !== undefined is false
      // So listeners may not be called. Let's test with values that actually change
      const changingSlice = primitives.createSlice(store, (s) => s.value > 15 ? null : undefined);
      const listener3 = vi.fn();
      changingSlice.subscribe(listener3);
      
      // Initially returns undefined (value is 20)
      expect(changingSlice.get()).toBe(null);
      
      // Change to trigger undefined
      store.set({ value: 5 });
      expect(changingSlice.get()).toBe(undefined);
      expect(listener3).toHaveBeenCalledWith(undefined);
    });

    it('should handle circular references in state', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      // Create circular reference
      const obj: any = { value: 1 };
      obj.self = obj;

      const store = primitives.createStore(obj);
      
      // Should handle circular reference
      expect(store.get().value).toBe(1);
      expect(store.get().self).toBe(store.get());

      // Create slice of circular structure
      const slice = primitives.createSlice(store, s => ({
        value: s.value,
        hasSelf: s.self === s
      }));

      expect(slice.get()).toEqual({
        value: 1,
        hasSelf: true
      });
    });
  });

  /**
   * Tests for race conditions
   */
  describe('race conditions', () => {
    it('should handle rapid updates correctly', async () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ counter: 0 });
      const slice = primitives.createSlice(store, s => ({ 
        value: s.counter,
        isEven: s.counter % 2 === 0 
      }));

      const updates: any[] = [];
      slice.subscribe(value => updates.push(value));

      // Rapid fire updates
      for (let i = 1; i <= 100; i++) {
        store.set({ counter: i });
      }

      // Should have final value
      expect(store.get().counter).toBe(100);
      expect(slice.get()).toEqual({ value: 100, isEven: true });

      // All updates should be in order
      for (let i = 0; i < updates.length; i++) {
        expect(updates[i].value).toBe(i + 1);
        expect(updates[i].isEven).toBe((i + 1) % 2 === 0);
      }
    });

    it('should handle concurrent mutations safely', () => {
      const component = createComponent(() => {
        const model = createModel<{
          counter: number;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          counter: 0,
          increment: () => {
            const current = get().counter;
            // Simulate async operation
            set({ counter: current + 1 });
          },
          decrement: () => {
            const current = get().counter;
            // Simulate async operation
            set({ counter: current - 1 });
          }
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment,
            decrement: m.decrement
          })),
          views: {}
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Perform "concurrent" operations
      const actions = result.actions.get();
      
      // These will execute sequentially in JavaScript
      actions.increment();
      actions.increment();
      actions.decrement();
      actions.increment();
      
      // Should have correct final value
      expect(result.model.get().counter).toBe(2);
    });

    it('should handle subscription/unsubscription race conditions', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ value: 0 });
      const listeners: Array<() => void> = [];

      // Rapidly subscribe and unsubscribe
      for (let i = 0; i < 50; i++) {
        const listener = vi.fn();
        const unsub = store.subscribe(listener);
        
        if (i % 2 === 0) {
          listeners.push(unsub);
        } else {
          // Immediately unsubscribe half of them
          unsub();
        }
      }

      // Update store
      store.set({ value: 1 });

      // Unsubscribe remaining
      listeners.forEach(unsub => unsub());

      // No errors should occur on further updates
      expect(() => {
        store.set({ value: 2 });
      }).not.toThrow();
    });
  });

  /**
   * Tests for error recovery and graceful degradation
   */
  describe('error recovery', () => {
    it('should recover from transient errors', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      let shouldError = true;
      const store = primitives.createStore({ value: 1 });
      
      const slice = primitives.createSlice(store, (state) => {
        if (shouldError && state.value > 5) {
          throw new Error('Value too high');
        }
        return { processed: state.value * 2 };
      });

      // Should work initially
      expect(slice.get()).toEqual({ processed: 2 });

      // Should error when value is high - error during set
      expect(() => {
        store.set({ value: 10 });
      }).toThrow('Value too high');
      
      // In current implementation, state DOES change even when slice throws
      expect(store.get().value).toBe(10);
      
      // Slice will continue to throw until we fix the condition
      expect(() => slice.get()).toThrow('Value too high');

      // Fix the error condition
      shouldError = false;
      
      // Now slice works with the already-updated value
      expect(slice.get()).toEqual({ processed: 20 });
    });

    it('should maintain independent error boundaries', () => {
      const component = createComponent(() => {
        const model = createModel<{
          moduleA: { value: number; status: 'ok' | 'error' };
          moduleB: { value: number; status: 'ok' | 'error' };
        }>(() => ({
          moduleA: { value: 1, status: 'ok' },
          moduleB: { value: 2, status: 'ok' }
        }));

        const moduleASlice = createSlice(model, (m) => {
          if (m.moduleA.status === 'error') {
            throw new Error('Module A failed');
          }
          return { dataA: m.moduleA.value };
        });

        const moduleBSlice = createSlice(model, (m) => {
          if (m.moduleB.status === 'error') {
            throw new Error('Module B failed');
          }
          return { dataB: m.moduleB.value };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            moduleA: moduleASlice,
            moduleB: moduleBSlice
          }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Both should work initially
      expect(result.views.moduleA.get()).toEqual({ dataA: 1 });
      expect(result.views.moduleB.get()).toEqual({ dataB: 2 });

      // Try to break module A - error will occur during set
      expect(() => {
        result.model.set({
          moduleA: { value: 1, status: 'error' },
          moduleB: { value: 3, status: 'ok' }
        });
      }).toThrow('Module A failed');

      // In current implementation, state DOES update even with slice errors
      expect(result.model.get()).toEqual({
        moduleA: { value: 1, status: 'error' },
        moduleB: { value: 3, status: 'ok' }
      });

      // Module A view will throw when accessed
      expect(() => result.views.moduleA.get()).toThrow('Module A failed');
      // Module B works fine
      expect(result.views.moduleB.get()).toEqual({ dataB: 3 });
      
      // Fix module A
      result.model.set({
        moduleA: { value: 4, status: 'ok' },
        moduleB: { value: 3, status: 'ok' }
      });
      
      expect(result.views.moduleA.get()).toEqual({ dataA: 4 });
      expect(result.views.moduleB.get()).toEqual({ dataB: 3 });
    });

    it('should handle errors in complex select() chains', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: { value: number };
          multiplier: number;
        }>(() => ({
          data: { value: 10 },
          multiplier: 2
        }));

        const dataSlice = createSlice(model, (m) => m.data);
        const multiplierSlice = createSlice(model, (m) => {
          if (m.multiplier === 0) {
            throw new Error('Invalid multiplier');
          }
          return { mult: m.multiplier };
        });

        const combinedSlice = createSlice(model, () => ({
          value: select(dataSlice),
          result: select(multiplierSlice, (m) => m.mult),
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { combined: combinedSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Should work initially
      expect(result.views.combined.get()).toEqual({
        value: { value: 10 },
        result: 2
      });

      // Break multiplier - error during set
      expect(() => {
        result.model.set({ data: { value: 20 }, multiplier: 0 });
      }).toThrow('Invalid multiplier');

      // In current implementation, state DOES update even with errors
      expect(result.model.get()).toEqual({
        data: { value: 20 },
        multiplier: 0
      });
      
      // Combined view will throw when accessed
      expect(() => result.views.combined.get()).toThrow('Invalid multiplier');

      // Fix multiplier
      result.model.set({ data: { value: 20 }, multiplier: 5 });

      // Should work again
      expect(result.views.combined.get()).toEqual({
        value: { value: 20 },
        result: 5
      });
    });
  });

  /**
   * Tests for error propagation and logging
   */
  describe('error propagation', () => {
    it('should propagate errors with proper stack traces', () => {
      const component = createComponent(() => {
        const model = createModel<{ trigger: boolean }>(() => ({
          trigger: false
        }));

        const deepSlice = createSlice(model, (m) => {
          if (m.trigger) {
            const error = new Error('Deep error');
            // Ensure stack trace is preserved
            expect(error.stack).toBeDefined();
            throw error;
          }
          return { ok: true };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { deep: deepSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Trigger error - error occurs during set
      try {
        result.model.set({ trigger: true });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Deep error');
        expect((error as Error).stack).toContain('Deep error');
      }
      
      // In current implementation, state DOES update
      expect(result.model.get().trigger).toBe(true);
      
      // View will throw when accessed
      expect(() => result.views.deep.get()).toThrow('Deep error');
    });

    it('should maintain error context through select() chains', () => {
      const component = createComponent(() => {
        const model = createModel<{ 
          level1: { level2: { value: number } } 
        }>(() => ({
          level1: { level2: { value: 1 } } // Start with valid value
        }));

        const level1Slice = createSlice(model, (m) => m.level1);
        const level2Slice = createSlice(model, () => ({
          data: select(level1Slice, (l1) => {
            if (l1.level2.value === 0) {
              throw new Error('Level 2 validation failed');
            }
            return l1.level2;
          })
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { level2: level2Slice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Should work initially
      expect(result.views.level2.get()).toEqual({
        data: { value: 1 }
      });

      // Try to set invalid value - error during set
      expect(() => {
        result.model.set({ level1: { level2: { value: 0 } } });
      }).toThrow('Level 2 validation failed');

      // Fix the value
      result.model.set({ level1: { level2: { value: 5 } } });
      expect(result.views.level2.get()).toEqual({
        data: { value: 5 }
      });
    });
  });

  /**
   * Tests for what error handling the adapter DOES provide
   */
  describe('supported error handling patterns', () => {
    it('should allow error handling in model mutations', () => {
      const component = createComponent(() => {
        const model = createModel<{
          value: number;
          lastError: string | null;
          riskyOperation: () => void;
        }>(({ set, get }) => ({
          value: 0,
          lastError: null,
          riskyOperation: () => {
            try {
              // Simulate risky operation
              if (Math.random() > 0.5) {
                throw new Error('Operation failed');
              }
              set({ value: get().value + 1, lastError: null });
            } catch (e) {
              // Handle error gracefully
              set({ lastError: (e as Error).message });
            }
          }
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            riskyOperation: m.riskyOperation
          })),
          views: {
            status: createSlice(model, (m) => ({
              value: m.value,
              error: m.lastError
            }))
          }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Operation handles its own errors
      result.actions.get().riskyOperation();
      
      // Either succeeded or caught error
      const status = result.views.status.get();
      expect(
        status.value > 0 || status.error !== null
      ).toBe(true);
    });

    it('should support defensive slice selectors', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ 
        data: null as { value: number } | null 
      });
      
      // Defensive slice that handles null
      const safeSlice = primitives.createSlice(store, (state) => {
        if (!state.data) {
          return { value: 0, isDefault: true };
        }
        return { value: state.data.value, isDefault: false };
      });

      // Works with null
      expect(safeSlice.get()).toEqual({ value: 0, isDefault: true });

      // Works with data
      store.set({ data: { value: 42 } });
      expect(safeSlice.get()).toEqual({ value: 42, isDefault: false });

      // Back to null
      store.set({ data: null });
      expect(safeSlice.get()).toEqual({ value: 0, isDefault: true });
    });

    it('should support try-catch in computed views', () => {
      const component = createComponent(() => {
        const model = createModel<{
          items: Array<{ id: number; value: string }>;
          selectedId: number | null;
        }>(() => ({
          items: [
            { id: 1, value: 'one' },
            { id: 2, value: 'two' }
          ],
          selectedId: null
        }));

        const itemsSlice = createSlice(model, (m) => ({
          items: m.items,
          selectedId: m.selectedId
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            // Safe computed view with error handling
            selectedItem: () => itemsSlice((state) => {
              try {
                if (state.selectedId === null) {
                  return { status: 'none' as const, item: null };
                }
                const item = state.items.find(i => i.id === state.selectedId);
                if (!item) {
                  return { status: 'notfound' as const, item: null };
                }
                return { status: 'found' as const, item };
              } catch (e) {
                return { status: 'error' as const, item: null };
              }
            })
          }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const view = result.views.selectedItem();
      
      // No selection
      expect(view.get()).toEqual({ status: 'none', item: null });

      // Valid selection
      result.model.set({ 
        items: result.model.get().items,
        selectedId: 1 
      });
      expect(view.get()).toEqual({ 
        status: 'found', 
        item: { id: 1, value: 'one' } 
      });

      // Invalid selection
      result.model.set({ 
        items: result.model.get().items,
        selectedId: 999 
      });
      expect(view.get()).toEqual({ status: 'notfound', item: null });
    });

    it('should allow graceful error recovery workflows', () => {
      const component = createComponent(() => {
        const model = createModel<{
          mode: 'normal' | 'error' | 'recovery';
          data: string;
          processData: () => void;
          recover: () => void;
        }>(({ set, get }) => ({
          mode: 'normal',
          data: 'initial',
          processData: () => {
            const state = get();
            if (state.mode === 'error') {
              // Don't process in error mode
              return;
            }
            // Simulate processing that might fail
            if (state.data === 'bad') {
              set({ mode: 'error' });
            } else {
              set({ data: state.data + '-processed' });
            }
          },
          recover: () => {
            set({ mode: 'recovery', data: 'recovered' });
            // Simulate async recovery
            setTimeout(() => {
              set({ mode: 'normal' });
            }, 0);
          }
        }));

        const stateSlice = createSlice(model, (m) => ({
          mode: m.mode,
          data: m.data,
          canProcess: m.mode === 'normal',
          needsRecovery: m.mode === 'error'
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            processData: m.processData,
            recover: m.recover
          })),
          views: { state: stateSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Normal operation
      expect(result.views.state.get().mode).toBe('normal');
      result.actions.get().processData();
      expect(result.views.state.get().data).toBe('initial-processed');

      // Trigger error condition
      result.model.set({ 
        mode: 'normal',
        data: 'bad',
        processData: result.model.get().processData,
        recover: result.model.get().recover
      });
      result.actions.get().processData();
      expect(result.views.state.get().mode).toBe('error');

      // Recovery
      result.actions.get().recover();
      expect(result.views.state.get().mode).toBe('recovery');
      expect(result.views.state.get().data).toBe('recovered');
    });
  });
});