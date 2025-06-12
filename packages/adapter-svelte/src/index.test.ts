/**
 * @fileoverview Tests for Svelte adapter
 */

import { describe, it, expect } from 'vitest';
import { createSvelteAdapter, wrapSvelteStore } from './index';
import { compose } from '@lattice/core';
import type { CreateStore } from '@lattice/core';
import { writable, get } from 'svelte/store';

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
    expect(store.counter.value()).toBe(0);
    expect(store.auth.user()).toBe(null);
    
    // Test mutations
    store.counter.increment();
    expect(store.counter.value()).toBe(1);
    
    store.auth.login('Alice');
    expect(store.auth.user()).toBe('Alice');
    
    // Test multiple mutations
    store.counter.increment();
    store.counter.increment();
    expect(store.counter.value()).toBe(3);
    
    // Test reset
    store.counter.reset();
    expect(store.counter.value()).toBe(0);
    
    store.auth.logout();
    expect(store.auth.user()).toBe(null);
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
    store.cart.addItem('Book', 20);
    store.cart.addItem('Pen', 5);
    
    expect(store.checkout.subtotal()).toBe(25);
    expect(store.checkout.total()).toBe(25);
    
    // Apply discount
    store.pricing.setDiscount(10);
    expect(store.checkout.discountAmount()).toBe(2.5);
    expect(store.checkout.total()).toBe(22.5);
    
    // Add more items
    store.cart.addItem('Notebook', 15);
    expect(store.checkout.subtotal()).toBe(40);
    expect(store.checkout.discountAmount()).toBe(4);
    expect(store.checkout.total()).toBe(36);
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
    const unsubscribe = store.subscribe(() => {
      notifications.push(store.state.value());
    });
    
    // Mutations should trigger subscriptions
    store.state.increment();
    expect(notifications).toEqual([1]);
    
    store.state.set(10);
    expect(notifications).toEqual([1, 10]);
    
    store.state.increment();
    expect(notifications).toEqual([1, 10, 11]);
    
    // Unsubscribe
    unsubscribe();
    store.state.increment();
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
    
    const unsub1 = store.subscribe(() => { count1++; });
    const unsub2 = store.subscribe(() => { count2++; });
    
    store.counter.increment();
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    
    // Unsubscribe one
    unsub1();
    store.counter.increment();
    expect(count1).toBe(1); // No change
    expect(count2).toBe(2); // Still notified
    
    unsub2();
  });
  
  it('should wrap existing Svelte stores', () => {
    // Create a custom Svelte store with initial state
    const svelteStore = writable({ 
      count: 5, 
      message: 'Hello',
      items: ['a', 'b', 'c']
    });
    
    // Wrap it as a Lattice adapter
    const adapter = wrapSvelteStore(svelteStore);
    
    // Test getState
    expect(adapter.getState()).toEqual({
      count: 5,
      message: 'Hello',
      items: ['a', 'b', 'c']
    });
    
    // Test setState
    adapter.setState({ count: 10 });
    expect(adapter.getState()).toEqual({
      count: 10,
      message: 'Hello',
      items: ['a', 'b', 'c']
    });
    
    // Test partial updates
    adapter.setState({ message: 'World' });
    expect(adapter.getState()).toEqual({
      count: 10,
      message: 'World',
      items: ['a', 'b', 'c']
    });
    
    // Test subscriptions
    let notificationCount = 0;
    const unsub = adapter.subscribe(() => {
      notificationCount++;
    });
    
    adapter.setState({ count: 20 });
    expect(notificationCount).toBe(1);
    
    // Verify the Svelte store also updated
    expect(get(svelteStore)).toEqual({
      count: 20,
      message: 'World',
      items: ['a', 'b', 'c']
    });
    
    unsub();
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
    const unsub1 = store.subscribe(() => {
      throw new Error('Listener 1 error');
    });
    
    // Subscribe with a normal listener
    let count = 0;
    const unsub2 = store.subscribe(() => {
      count++;
    });
    
    // Trigger update
    store.actions.increment();
    
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