import { describe, it, expect, vi } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createSlice, createComponent } from '@lattice/core';

describe('Memory Adapter - Lifecycle and Cleanup', () => {
  /**
   * Tests for the destroy() method as specified in the adapter architecture spec:
   * "interface Store<T> { ... destroy?: () => void; }"
   */
  describe('destroy() lifecycle', () => {
    it('should cleanup slice subscriptions when destroy is called', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ count: 0 });
      const slice = primitives.createSlice(store, state => ({ value: state.count }));
      
      // Verify slice has destroy method
      expect(slice.destroy).toBeDefined();
      expect(typeof slice.destroy).toBe('function');
      
      // Subscribe to slice
      const listener = vi.fn();
      slice.subscribe(listener);
      
      // Update should trigger listener
      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      
      // Destroy the slice
      slice.destroy?.();
      
      // Updates should no longer trigger listener
      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should cleanup nested slice subscriptions', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ x: 0, y: 0 });
      
      // Create a chain of slices
      const positionSlice = primitives.createSlice(store, state => ({
        x: state.x,
        y: state.y
      }));
      
      const distanceSlice = primitives.createSlice(positionSlice, pos => ({
        distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y)
      }));
      
      const listener = vi.fn();
      distanceSlice.subscribe(listener);
      
      // Verify subscription works
      store.set({ x: 3, y: 4 });
      expect(listener).toHaveBeenCalledWith({ distance: 5 });
      
      // Destroy the intermediate slice
      positionSlice.destroy?.();
      
      // Updates should no longer propagate through destroyed slice
      store.set({ x: 5, y: 12 });
      expect(listener).toHaveBeenCalledTimes(1); // No new calls
    });

    it('should handle multiple slice cleanup independently', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ value: 0 });
      
      // Create multiple slices
      const slice1 = primitives.createSlice(store, s => ({ val: s.value }));
      const slice2 = primitives.createSlice(store, s => ({ doubled: s.value * 2 }));
      
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      slice1.subscribe(listener1);
      slice2.subscribe(listener2);
      
      // Both should receive updates
      store.set({ value: 1 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      
      // Destroy only slice1
      slice1.destroy?.();
      
      // Only slice2 should receive updates
      store.set({ value: 2 });
      expect(listener1).toHaveBeenCalledTimes(1); // No new calls
      expect(listener2).toHaveBeenCalledTimes(2); // Still receiving
    });
  });

  /**
   * Tests for memory leak prevention and proper cleanup patterns
   */
  describe('memory leak prevention', () => {
    it('should prevent memory leaks when slices are created and destroyed repeatedly', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ count: 0 });
      
      // Track subscription counts by spying on store.subscribe
      const originalSubscribe = store.subscribe;
      let activeSubscriptions = 0;
      
      store.subscribe = (listener: any) => {
        activeSubscriptions++;
        const unsub = originalSubscribe.call(store, listener);
        return () => {
          activeSubscriptions--;
          unsub();
        };
      };
      
      // Create and destroy many slices
      for (let i = 0; i < 100; i++) {
        const slice = primitives.createSlice(store, s => ({ value: s.count }));
        const unsub = slice.subscribe(() => {});
        
        // Should have exactly 2 subscriptions (slice to store + our subscription to slice)
        expect(activeSubscriptions).toBe(1);
        
        // Cleanup
        unsub();
        slice.destroy?.();
      }
      
      // All subscriptions should be cleaned up
      expect(activeSubscriptions).toBe(0);
    });

    it('should handle subscription cleanup in component lifecycle', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: string[];
          addItem: (item: string) => void;
        }>(({ set, get }) => ({
          data: [],
          addItem: (item: string) => set({ data: [...get().data, item] })
        }));
        
        const dataSlice = createSlice(model, m => ({ items: m.data }));
        
        return {
          model,
          actions: createSlice(model, m => ({ addItem: m.addItem })),
          views: {
            list: dataSlice,
            count: () => dataSlice(d => ({ count: d.items.length }))
          }
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      
      // Track all subscriptions
      const subscriptions: Array<() => void> = [];
      
      // Subscribe to views
      subscriptions.push(result.views.list.subscribe(() => {}));
      
      const countView = result.views.count();
      subscriptions.push(countView.subscribe(() => {}));
      
      // Add data
      result.actions.get().addItem('test');
      
      // Clean up all subscriptions
      subscriptions.forEach(unsub => unsub());
      
      // If views have destroy methods, call them
      result.views.list.destroy?.();
      countView.destroy?.();
      
      // No errors should occur when updating after cleanup
      expect(() => {
        result.actions.get().addItem('after cleanup');
      }).not.toThrow();
    });
  });

  /**
   * Tests for subscription behavior and cleanup patterns
   */
  describe('subscription patterns', () => {
    it('should not call listeners after unsubscribe', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ value: 0 });
      const slice = primitives.createSlice(store, s => s);
      
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      const unsub1 = slice.subscribe(listener1);
      const unsub2 = slice.subscribe(listener2);
      
      // Both get called
      store.set({ value: 1 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      
      // Unsubscribe first
      unsub1();
      
      // Only second gets called
      store.set({ value: 2 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);
      
      // Unsubscribe second
      unsub2();
      
      // Neither gets called
      store.set({ value: 3 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);
    });

    it('should handle resubscription after unsubscribe', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ count: 0 });
      const listener = vi.fn();
      
      // Subscribe
      let unsub = store.subscribe(listener);
      
      // Update
      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      
      // Unsubscribe
      unsub();
      
      // No updates received
      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
      
      // Resubscribe
      unsub = store.subscribe(listener);
      
      // Updates received again
      store.set({ count: 3 });
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ count: 3 });
    });
  });
});