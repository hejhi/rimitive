import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { vanillaAdapter, createLatticeStore, type Selectors, type SetState } from '@lattice/core';
import { sliceValue, sliceValues, derivedSlice, asReadable } from './svelte.js';

describe('Svelte runtime utilities', () => {
  // Create a test store
  const createTestStore = () => {
    // Create the adapter directly so we can access its subscribe method
    const adapter = vanillaAdapter({
      count: 0,
      name: 'test', 
      items: [] as string[],
    });
    const createSlice = createLatticeStore(adapter);
    
    const counter = createSlice(
      (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ count: selectors.count }),
      ({ count }: { count: () => number }, set: SetState<{ count: number; name: string; items: string[] }>) => ({
        value: () => count(),
        increment: () => set(
          (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ count: selectors.count }),
          ({ count }: { count: () => number }) => ({ count: count() + 1 })
        ),
        doubled: () => count() * 2,
      })
    );
    
    const user = createSlice(
      (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ name: selectors.name }),
      ({ name }: { name: () => string }, set: SetState<{ count: number; name: string; items: string[] }>) => ({
        name: () => name(),
        setName: (newName: string) => set(
          (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ name: selectors.name }),
          () => ({ name: newName })
        ),
      })
    );
    
    // Use the adapter's subscribe method for store-level changes
    return {
      counter: counter(),
      user: user(),
      subscribe: adapter.subscribe,
    };
  };
  
  describe('sliceValue', () => {
    it('should create a readable store from a selector', () => {
      const store = createTestStore();
      const count = sliceValue(store, s => s.counter.value());
      
      // Subscribe to ensure the store is active
      const values: number[] = [];
      const unsubscribe = count.subscribe(v => values.push(v));
      
      expect(values[0]).toBe(0);
      expect(get(count)).toBe(0);
      
      store.counter.increment();
      
      expect(values[1]).toBe(1);
      expect(get(count)).toBe(1);
      
      unsubscribe();
    });
    
    it('should update when store changes', () => {
      const store = createTestStore();
      const name = sliceValue(store, s => s.user.name());
      
      // Subscribe to ensure the store is active
      const values: string[] = [];
      const unsubscribe = name.subscribe(v => values.push(v));
      
      expect(values[0]).toBe('test');
      expect(get(name)).toBe('test');
      
      store.user.setName('Alice');
      
      expect(values[1]).toBe('Alice');
      expect(get(name)).toBe('Alice');
      
      unsubscribe();
    });
    
    it('should handle complex selectors', () => {
      const store = createTestStore();
      const summary = sliceValue(store, s => ({
        count: s.counter.value(),
        doubled: s.counter.doubled(),
        name: s.user.name(),
      }));
      
      // Subscribe to ensure the store is active
      const values: any[] = [];
      const unsubscribe = summary.subscribe(v => values.push(v));
      
      expect(values[0]).toEqual({
        count: 0,
        doubled: 0,
        name: 'test',
      });
      
      store.counter.increment();
      store.user.setName('Bob');
      
      expect(values[values.length - 1]).toEqual({
        count: 1,
        doubled: 2,
        name: 'Bob',
      });
      expect(get(summary)).toEqual({
        count: 1,
        doubled: 2,
        name: 'Bob',
      });
      
      unsubscribe();
    });
  });
  
  describe('sliceValues', () => {
    it('should create multiple readable stores', () => {
      const store = createTestStore();
      const values = sliceValues(store, {
        count: s => s.counter.value(),
        doubled: s => s.counter.doubled(),
        name: s => s.user.name(),
      });
      
      // Subscribe to all stores to ensure they are active
      const results: any = { count: [], doubled: [], name: [] };
      const unsubscribes = [
        values.count.subscribe(v => results.count.push(v)),
        values.doubled.subscribe(v => results.doubled.push(v)),
        values.name.subscribe(v => results.name.push(v))
      ];
      
      expect(results.count[0]).toBe(0);
      expect(results.doubled[0]).toBe(0);
      expect(results.name[0]).toBe('test');
      
      store.counter.increment();
      
      expect(results.count[1]).toBe(1);
      expect(results.doubled[1]).toBe(2);
      expect(results.name.length).toBe(1); // Name didn't change
      
      expect(get(values.count)).toBe(1);
      expect(get(values.doubled)).toBe(2);
      expect(get(values.name)).toBe('test');
      
      unsubscribes.forEach(u => u());
    });
  });
  
  describe('derivedSlice', () => {
    it('should create a derived store', () => {
      const store = createTestStore();
      const label = derivedSlice(store, s => 
        `${s.user.name()}: ${s.counter.value()}`
      );
      
      // Subscribe to ensure the store is active
      const values: string[] = [];
      const unsubscribe = label.subscribe(v => values.push(v));
      
      expect(values[0]).toBe('test: 0');
      expect(get(label)).toBe('test: 0');
      
      store.counter.increment();
      expect(values[1]).toBe('test: 1');
      expect(get(label)).toBe('test: 1');
      
      store.user.setName('Alice');
      expect(values[2]).toBe('Alice: 1');
      expect(get(label)).toBe('Alice: 1');
      
      unsubscribe();
    });
  });
  
  describe('asReadable', () => {
    it('should wrap the store as a readable', () => {
      const store = createTestStore();
      const readable = asReadable(store);
      
      const storeValue = get(readable);
      expect(storeValue).toBe(store);
      expect(storeValue.counter.value()).toBe(0);
      
      // The readable itself doesn't change, only internal state
      store.counter.increment();
      expect(get(readable)).toBe(store);
      expect(get(readable).counter.value()).toBe(1);
    });
  });
});