/**
 * @fileoverview Tests for Svelte adapter
 */

import { describe, it, expect } from 'vitest';
import { createSvelteAdapter } from './index';
import { compose } from '@lattice/core';
import type { CreateStore } from '@lattice/core';

describe('Svelte Adapter', () => {
  it('should create a working adapter with basic store operations', () => {
    const createComponent = (createStore: CreateStore<{ count: number; user: string | null }>) => {
      const createSlice = createStore({ count: 0, user: null });
      
      const counter = createSlice(({ get, set }) => ({
        value: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        reset: () => set({ count: 0 })
      }));
      
      const auth = createSlice(({ get, set }) => ({
        user: () => get().user,
        login: (name: string) => set({ user: name }),
        logout: () => set({ user: null })
      }));
      
      return { counter, auth };
    };
    
    const store = createSvelteAdapter(createComponent);
    
    // Test initial state
    expect(store.counter.selector.value()).toBe(0);
    expect(store.auth.selector.user()).toBe(null);
    
    // Test mutations
    store.counter.selector.increment();
    expect(store.counter.selector.value()).toBe(1);
    
    store.auth.selector.login('Alice');
    expect(store.auth.selector.user()).toBe('Alice');
    
    // Test multiple mutations
    store.counter.selector.increment();
    store.counter.selector.increment();
    expect(store.counter.selector.value()).toBe(3);
    
    // Test reset
    store.counter.selector.reset();
    expect(store.counter.selector.value()).toBe(0);
    
    store.auth.selector.logout();
    expect(store.auth.selector.user()).toBe(null);
  });
  
  it('should work with compose for slice dependencies', () => {
    const createComponent = (createStore: CreateStore<{
      items: { id: number; name: string; price: number }[];
      discount: number;
    }>) => {
      const createSlice = createStore({ items: [], discount: 0 });
      
      const cart = createSlice(({ get, set }) => ({
        items: () => get().items,
        addItem: (name: string, price: number) => {
          const newItem = { id: Date.now(), name, price };
          set({ items: [...get().items, newItem] });
        },
        removeItem: (id: number) => {
          set({ items: get().items.filter(item => item.id !== id) });
        },
        clear: () => set({ items: [] })
      }));
      
      const pricing = createSlice(({ get, set }) => ({
        discount: () => get().discount,
        setDiscount: (percent: number) => set({ discount: percent })
      }));
      
      const checkout = createSlice(
        compose({ cart, pricing }, (_, { cart, pricing }) => ({
          subtotal: () => cart.items().reduce((sum, item) => sum + item.price, 0),
          discountAmount: () => {
            const subtotal = cart.items().reduce((sum, item) => sum + item.price, 0);
            return subtotal * (pricing.discount() / 100);
          },
          total: () => {
            const subtotal = cart.items().reduce((sum, item) => sum + item.price, 0);
            const discount = subtotal * (pricing.discount() / 100);
            return subtotal - discount;
          }
        }))
      );
      
      return { cart, pricing, checkout };
    };
    
    const store = createSvelteAdapter(createComponent);
    
    // Add items
    store.cart.selector.addItem('Book', 20);
    store.cart.selector.addItem('Pen', 5);
    
    expect(store.checkout.selector.subtotal()).toBe(25);
    expect(store.checkout.selector.total()).toBe(25);
    
    // Apply discount
    store.pricing.selector.setDiscount(10);
    expect(store.checkout.selector.discountAmount()).toBe(2.5);
    expect(store.checkout.selector.total()).toBe(22.5);
    
    // Add more items
    store.cart.selector.addItem('Notebook', 15);
    expect(store.checkout.selector.subtotal()).toBe(40);
    expect(store.checkout.selector.discountAmount()).toBe(4);
    expect(store.checkout.selector.total()).toBe(36);
  });
  
  it('should support subscriptions', () => {
    const createComponent = (createStore: CreateStore<{ value: number }>) => {
      const createSlice = createStore({ value: 0 });
      
      const state = createSlice(({ get, set }) => ({
        value: () => get().value,
        set: (value: number) => set({ value }),
        increment: () => set({ value: get().value + 1 })
      }));
      
      return { state };
    };
    
    const store = createSvelteAdapter(createComponent);
    
    // Track notifications
    const notifications: number[] = [];
    const unsubscribe = store.state.subscribe(() => {
      notifications.push(store.state.selector.value());
    });
    
    // Mutations should trigger subscriptions
    store.state.selector.increment();
    expect(notifications).toEqual([1]);
    
    store.state.selector.set(10);
    expect(notifications).toEqual([1, 10]);
    
    store.state.selector.increment();
    expect(notifications).toEqual([1, 10, 11]);
    
    // Unsubscribe
    unsubscribe();
    store.state.selector.increment();
    expect(notifications).toEqual([1, 10, 11]); // No new notification
  });
  
  it('should handle multiple subscribers', () => {
    const createComponent = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });
      
      const counter = createSlice(({ get, set }) => ({
        value: () => get().count,
        increment: () => set({ count: get().count + 1 })
      }));
      
      return { counter };
    };
    
    const store = createSvelteAdapter(createComponent);
    
    // Multiple subscribers
    let count1 = 0;
    let count2 = 0;
    
    const unsub1 = store.counter.subscribe(() => { count1++; });
    const unsub2 = store.counter.subscribe(() => { count2++; });
    
    store.counter.selector.increment();
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    
    // Unsubscribe one
    unsub1();
    store.counter.selector.increment();
    expect(count1).toBe(1); // No change
    expect(count2).toBe(2); // Still notified
    
    unsub2();
  });
  it('should handle errors in listeners', () => {
    const errors: unknown[] = [];
    
    const createComponent = (createStore: CreateStore<{ value: number }>) => {
      const createSlice = createStore({ value: 0 });
      const actions = createSlice(({ get, set }) => ({
        increment: () => set({ value: get().value + 1 })
      }));
      return { actions };
    };
    
    const store = createSvelteAdapter(createComponent, {
      onError: (error) => errors.push(error)
    });
    
    // Subscribe with a throwing listener
    const unsub1 = store.actions.subscribe(() => {
      throw new Error('Listener 1 error');
    });
    
    // Subscribe with a normal listener
    let count = 0;
    const unsub2 = store.actions.subscribe(() => {
      count++;
    });
    
    // Trigger update
    store.actions.selector.increment();
    
    // Should have caught the error
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe('Listener 1 error');
    
    // But the other listener should still work
    expect(count).toBe(1);
    
    unsub1();
    unsub2();
  });
});