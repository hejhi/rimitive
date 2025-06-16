/**
 * @fileoverview Tests for the Svelte adapter
 */

import { describe, it, expect } from 'vitest';
import { createSvelteAdapter } from './index';
import type { CreateStore } from '@lattice/core';

describe('Svelte Adapter', () => {
  it('should support both Lattice and Svelte subscription patterns', () => {
    const createComponent = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });
      
      const counter = createSlice(({ get, set }) => ({
        value: () => get().count,
        increment: () => set({ count: get().count + 1 })
      }));
      
      return { counter };
    };
    
    const store = createSvelteAdapter(createComponent);
    
    // Test Lattice pattern
    let latticeNotifications = 0;
    const unsubLattice = store.counter.subscribe(() => {
      latticeNotifications++;
    });
    
    // Test that it works at all  
    expect(store.counter.selector.value()).toBe(0);
    
    // Increment should notify 
    store.counter.selector.increment();
    
    expect(latticeNotifications).toBe(1);
    expect(store.counter.selector.value()).toBe(1);
    
    unsubLattice();
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
      throw new Error('Lattice listener error');
    });
    
    // Update should catch the error
    store.actions.selector.increment();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('Lattice listener error');
    
    unsub1();
  });
});