import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createStore, type ComponentFactory } from '@lattice/core';
import { useStore, useSignal } from './svelte';

describe('Svelte integration', () => {
  // Create test components using the new API
  const createTestStores = () => {
    const Counter: ComponentFactory<{ count: number }, any> = ({ store, computed, set }) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
      doubled: computed(() => store.count() * 2),
    });

    const User: ComponentFactory<{ name: string }, any> = ({ store, set }) => ({
      name: store.name,
      setName: (newName: string) => set(store.name, newName),
    });

    const Items: ComponentFactory<{ items: string[] }, any> = ({ store, computed, set }) => ({
      all: store.items,
      add: (item: string) => set(store.items, [...store.items(), item]),
      count: computed(() => store.items().length),
    });

    return { 
      counterStore: createStore(Counter, { count: 0 }),
      userStore: createStore(User, { name: 'test' }),
      itemsStore: createStore(Items, { items: [] })
    };
  };

  describe('useStore', () => {
    it('should create a Svelte store from Lattice store', () => {
      const { counterStore } = createTestStores();
      const counter = useStore(counterStore);

      // Get current value
      expect(get(counter).value()).toBe(0);
      expect(get(counter).doubled()).toBe(0);

      // Update through actions
      get(counter).increment();
      
      expect(get(counter).value()).toBe(1);
      expect(get(counter).doubled()).toBe(2);
    });

    it('should update when any signal changes', () => {
      const { userStore } = createTestStores();
      const user = useStore(userStore);
      
      let updateCount = 0;
      const unsubscribe = user.subscribe(() => {
        updateCount++;
      });

      expect(updateCount).toBe(1); // Initial subscription
      
      // Change the name
      get(user).setName('new name');
      
      expect(updateCount).toBe(2);
      expect(get(user).name()).toBe('new name');
      
      unsubscribe();
    });

    it('should work with multiple subscribers', () => {
      const { counterStore } = createTestStores();
      const counter = useStore(counterStore);
      
      let subscriber1Count = 0;
      let subscriber2Count = 0;
      
      const unsub1 = counter.subscribe(() => subscriber1Count++);
      const unsub2 = counter.subscribe(() => subscriber2Count++);
      
      expect(subscriber1Count).toBe(1);
      expect(subscriber2Count).toBe(1);
      
      get(counter).increment();
      
      expect(subscriber1Count).toBe(2);
      expect(subscriber2Count).toBe(2);
      
      unsub1();
      get(counter).increment();
      
      expect(subscriber1Count).toBe(2); // No longer updating
      expect(subscriber2Count).toBe(3); // Still updating
      
      unsub2();
    });
  });

  describe('useSignal', () => {
    it('should return signal as Svelte store', () => {
      const { counterStore } = createTestStores();
      const count = useSignal(counterStore.value);
      
      expect(get(count)).toBe(0);
      
      counterStore.increment();
      expect(get(count)).toBe(1);
    });

    it('should work with computed values', () => {
      const { counterStore } = createTestStores();
      const doubled = useSignal(counterStore.doubled);
      
      expect(get(doubled)).toBe(0);
      
      counterStore.increment();
      expect(get(doubled)).toBe(2);
      
      counterStore.increment();
      expect(get(doubled)).toBe(4);
    });

    it('should support subscriptions', () => {
      const { itemsStore } = createTestStores();
      const items = useSignal(itemsStore.all);
      
      let updateCount = 0;
      const unsubscribe = items.subscribe(() => updateCount++);
      
      expect(updateCount).toBe(1); // Initial
      expect(get(items)).toEqual([]);
      
      itemsStore.add('item1');
      expect(updateCount).toBe(2);
      expect(get(items)).toEqual(['item1']);
      
      itemsStore.add('item2');
      expect(updateCount).toBe(3);
      expect(get(items)).toEqual(['item1', 'item2']);
      
      unsubscribe();
    });
  });
});